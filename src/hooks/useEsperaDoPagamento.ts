"use client";

// cobranca-e-plano-do-cliente RF2-33 (BP-T §5): espera da confirmação depois de
// "Pagar fatura". Guarda só o horário do clique e o vencimento, por empresa, no
// sessionStorage; consulta ao voltar o foco (no máximo a cada 5 s) e a cada 15 s
// com a aba visível, por até 10 min depois do clique.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResumoDeCobranca } from '@/types/cobranca';

export type EstadoDaEspera = 'parado' | 'aguardando' | 'confirmado' | 'parcial' | 'sem_confirmacao';

const INTERVALO_MS = 15_000;
const FOCO_MINIMO_MS = 5_000;
const LIMITE_MS = 10 * 60_000;
const FALHAS_PARA_AVISAR = 3;

interface Guardado {
  clicado_em: number;
  vencimento: string;
}

function chave(tenantId: string): string {
  return `cobranca-aguardando:${tenantId}`;
}

function lerGuardado(tenantId: string): Guardado | null {
  if (!tenantId || typeof window === 'undefined') return null;
  const bruto = sessionStorage.getItem(chave(tenantId));
  if (!bruto) return null;
  try {
    const valor = JSON.parse(bruto) as Guardado;
    if (typeof valor.clicado_em !== 'number' || typeof valor.vencimento !== 'string') throw new Error('chave inválida');
    return valor;
  } catch {
    sessionStorage.removeItem(chave(tenantId));
    return null;
  }
}

function apagar(tenantId: string) {
  if (tenantId && typeof window !== 'undefined') sessionStorage.removeItem(chave(tenantId));
}

export function useEsperaDoPagamento(
  tenantId: string,
  resumo: ResumoDeCobranca | null,
  recarregar: () => Promise<void>,
) {
  const [estado, setEstado] = useState<EstadoDaEspera>('parado');
  const [falhou, setFalhou] = useState(false);
  const [guardado, setGuardado] = useState<Guardado | null>(null);
  // SPEC_DEVIATION: além do contrato da TASK-FE-P04, devolve o vencimento pago no
  // estado 'parcial'. Reason: a frase "Recebemos o pagamento da fatura de DD/MM" usa
  // o vencimento guardado no clique, que só o hook conhece depois de recarregar a página.
  const [vencimentoPago, setVencimentoPago] = useState<string | null>(null);
  const falhasRef = useRef(0);
  const ultimaConsultaRef = useRef(0);
  const recarregarRef = useRef(recarregar);
  recarregarRef.current = recarregar;

  const consultar = useCallback(() => {
    ultimaConsultaRef.current = Date.now();
    recarregarRef.current().then(
      () => {
        falhasRef.current = 0;
        setFalhou(false);
      },
      () => {
        falhasRef.current += 1;
        if (falhasRef.current >= FALHAS_PARA_AVISAR) setFalhou(true);
      },
    );
  }, []);

  // Empresa nova (ou página recarregada): retoma a espera guardada, se houver.
  useEffect(() => {
    falhasRef.current = 0;
    setFalhou(false);
    setVencimentoPago(null);
    const salvo = lerGuardado(tenantId);
    setGuardado(salvo);
    if (!salvo) {
      setEstado('parado');
    } else if (Date.now() - salvo.clicado_em >= LIMITE_MS) {
      apagar(tenantId);
      setEstado('sem_confirmacao');
    } else {
      setEstado('aguardando');
    }
  }, [tenantId]);

  // Consultas por intervalo e o limite de 10 min, só enquanto aguarda.
  useEffect(() => {
    if (estado !== 'aguardando' || !guardado) return;
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') consultar();
    }, INTERVALO_MS);
    const limite = setTimeout(() => {
      clearInterval(intervalo);
      apagar(tenantId);
      setEstado('sem_confirmacao');
    }, Math.max(0, guardado.clicado_em + LIMITE_MS - Date.now()));
    return () => {
      clearInterval(intervalo);
      clearTimeout(limite);
    };
  }, [estado, guardado, tenantId, consultar]);

  // Ao voltar o foco: consulta na hora, no máximo uma vez a cada 5 s (vale também depois dos 10 min).
  useEffect(() => {
    if (estado !== 'aguardando' && estado !== 'sem_confirmacao') return;
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - ultimaConsultaRef.current < FOCO_MINIMO_MS) return;
      consultar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
  }, [estado, consultar]);

  // Desfecho pelo resumo lido.
  useEffect(() => {
    if (!resumo || !guardado) return;
    if (estado !== 'aguardando' && estado !== 'sem_confirmacao') return;
    if (resumo.situacao === 'em_dia') {
      apagar(tenantId);
      setEstado('confirmado');
      return;
    }
    const emAtraso = resumo.situacao === 'em_atraso' || resumo.situacao === 'bloqueado';
    if (emAtraso && resumo.fatura && resumo.fatura.vencimento !== guardado.vencimento) {
      apagar(tenantId);
      setVencimentoPago(guardado.vencimento);
      setEstado('parcial');
    }
  }, [resumo, guardado, estado, tenantId]);

  const iniciar = useCallback(
    (vencimento: string) => {
      const novo: Guardado = { clicado_em: Date.now(), vencimento };
      sessionStorage.setItem(chave(tenantId), JSON.stringify(novo));
      falhasRef.current = 0;
      setFalhou(false);
      setVencimentoPago(null);
      setGuardado(novo);
      setEstado('aguardando');
    },
    [tenantId],
  );

  const conferirAgora = useCallback(() => {
    consultar();
  }, [consultar]);

  const fechar = useCallback(() => {
    apagar(tenantId);
    setGuardado(null);
    setVencimentoPago(null);
    setEstado('parado');
  }, [tenantId]);

  return { estado, falhou, vencimentoPago, iniciar, conferirAgora, fechar };
}
