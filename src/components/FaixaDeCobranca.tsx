"use client";

// cobranca-e-plano-do-cliente RF2-32: faixa de cobrança do Portal, acima do cabeçalho
// de toda página (BP-T §4). Textos aprovados; a UI não decide autorização: o link de
// pagar só existe quando a API mandou (pode_gerir).
import { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, ExternalLink, Lock, RefreshCw, X } from 'lucide-react';
import { useCobranca } from '@/contexts/CobrancaContext';
import { useTenant } from '@/contexts/TenantContext';
import { useEsperaDoPagamento } from '@/hooks/useEsperaDoPagamento';
import { ferramentasCitadas, formatarData, formatarReais } from '@/lib/cobrancaTexto';
import type { ResumoDeCobranca } from '@/types/cobranca';

const EMAIL_DO_ATENDIMENTO = 'atendimento@unumpeople.com.br';
const LINHA_DO_BOLETO = 'Pix confirma na hora. Boleto pode levar até 3 dias úteis para ser confirmado.';

const BOTAO_SECUNDARIO =
  'w-full md:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 border border-gray-300 bg-white rounded-lg text-sm font-bold text-gray-700 px-4 py-2 hover:bg-gray-50 transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue';

const BOTAO_PRIMARIO =
  'w-full md:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 bg-brand-blue text-white rounded-xl font-bold text-sm py-2.5 px-4 hover:brightness-110 transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2';

function data(valor: string | undefined): string {
  return valor ? formatarData(valor) : '';
}

function textoDoEstado(resumo: ResumoDeCobranca, servicosDoPlano: string[]): string {
  switch (resumo.situacao) {
    case 'em_atraso': {
      const ferramentas = ferramentasCitadas(servicosDoPlano);
      // RF2-32a: conta sem `DelinquencySince` vem sem as datas; nunca frase com data vazia.
      if (!resumo.pagar_ate || !resumo.vencida_em) {
        return resumo.fatura
          ? `Sua fatura de ${formatarReais(resumo.fatura.valor)} está em atraso. Pague para não perder o acesso a ${ferramentas}.`
          : `Há uma fatura em atraso nesta conta. Pague para não perder o acesso a ${ferramentas}.`;
      }
      if (resumo.fatura) {
        return `Sua fatura de ${formatarReais(resumo.fatura.valor)} venceu em ${data(resumo.fatura.vencimento)}. Pague até ${data(resumo.pagar_ate)} para não perder o acesso a ${ferramentas}.`;
      }
      return `Sua fatura venceu em ${data(resumo.vencida_em)}. Pague até ${data(resumo.pagar_ate)} para não perder o acesso a ${ferramentas}.`;
    }
    case 'bloqueado':
      return `Acesso a ${ferramentasCitadas(resumo.ferramentas_bloqueadas)} bloqueado por fatura em atraso. Sua página publicada sai do ar em ${data(resumo.fora_do_ar_em)}.`;
    case 'fora_do_ar':
      return `Sua página está fora do ar por falta de pagamento. A conta será cancelada em ${data(resumo.cancelamento_em)}.`;
    default:
      return '';
  }
}

function AviseOResponsavel() {
  return (
    <p className="flex items-center gap-1.5 text-sm font-semibold">
      <Lock size={14} aria-hidden="true" className="shrink-0" />
      Avise o responsável pela conta
    </p>
  );
}

function LinhaSemLink() {
  return (
    <p className="text-sm">
      Não conseguimos abrir o link da fatura. Escreva para{' '}
      <a href={`mailto:${EMAIL_DO_ATENDIMENTO}`} className="font-semibold underline">
        {EMAIL_DO_ATENDIMENTO}
      </a>{' '}
      que enviamos para você.
    </p>
  );
}

function Acao({
  resumo,
  aoPagar,
  pagarComoSecundario,
}: {
  resumo: ResumoDeCobranca;
  aoPagar: (vencimento: string) => void;
  pagarComoSecundario: boolean;
}) {
  if (!resumo.pode_gerir) return <AviseOResponsavel />;

  // Fase 4 (RF4-05, BP-T §4.2): a reativação é feita pelo cliente, na tela /reativar.
  if (resumo.situacao === 'fora_do_ar') {
    return (
      <a href="/reativar" className={BOTAO_PRIMARIO}>
        Reativar minha conta
      </a>
    );
  }

  // Sem fatura registrada (ou registrada sem link): não há o que pagar pela tela; a linha
  // do e-mail fica embaixo do texto (LinhaSemLink).
  if (!resumo.fatura?.link) return null;

  const { link, vencimento } = resumo.fatura;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => aoPagar(vencimento)}
      className={pagarComoSecundario ? BOTAO_SECUNDARIO : BOTAO_PRIMARIO}
    >
      Pagar fatura
      <ExternalLink size={16} aria-hidden="true" />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}

export default function FaixaDeCobranca() {
  const { resumo, erro, recarregar } = useCobranca();
  const { activeTenantId, availableTenants } = useTenant();
  const espera = useEsperaDoPagamento(activeTenantId, resumo, recarregar);
  // Último resumo em atraso: diz, depois de confirmado, se o acesso estava bloqueado e a quê.
  const ultimoAtrasoRef = useRef<ResumoDeCobranca | null>(null);
  useEffect(() => {
    if (resumo?.situacao === 'em_atraso' || resumo?.situacao === 'bloqueado') ultimoAtrasoRef.current = resumo;
  }, [resumo]);

  if (erro) {
    return (
      <section aria-label="Aviso de cobrança" className="bg-red-50 border-b border-red-200 md:border-b-0 md:border-l-4 md:border-red-500">
        <div role="alert" className="max-w-6xl mx-auto px-6 py-3 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle size={20} aria-hidden="true" className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-red-800 text-sm">Erro</h2>
              <p className="text-red-700 text-sm mt-1">Não foi possível conferir a situação da sua fatura.</p>
            </div>
          </div>
          <button type="button" onClick={() => { recarregar().catch(() => undefined); }} className={BOTAO_SECUNDARIO}>
            Tentar de novo
          </button>
        </div>
      </section>
    );
  }

  if (espera.estado === 'confirmado') {
    const anterior = ultimoAtrasoRef.current;
    return (
      <section aria-label="Aviso de cobrança" className="bg-green-50 border-b border-green-200 text-green-800">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-start md:items-center gap-3">
          <CheckCircle size={20} aria-hidden="true" className="shrink-0 mt-0.5 md:mt-0" />
          <div role="status" className="text-sm flex-1">
            <p className="font-semibold">Pagamento confirmado. Obrigado!</p>
            {anterior?.situacao === 'bloqueado' && (
              <p className="mt-1">O acesso a {ferramentasCitadas(anterior.ferramentas_bloqueadas)} está liberado.</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={espera.fechar}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-green-100 transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  }

  if (!resumo) return null;
  if (resumo.situacao !== 'em_atraso' && resumo.situacao !== 'bloqueado' && resumo.situacao !== 'fora_do_ar') {
    return null;
  }

  const servicosDoPlano = availableTenants.find((t) => t.id === activeTenantId)?.enabled_services ?? [];
  const emAtraso = resumo.situacao === 'em_atraso';
  const podePagar = resumo.situacao !== 'fora_do_ar';
  const aguardando = podePagar && espera.estado === 'aguardando';
  const semConfirmacao = podePagar && espera.estado === 'sem_confirmacao';
  const emEspera = aguardando || semConfirmacao;
  const Icone = aguardando ? RefreshCw : emAtraso ? AlertCircle : Lock;

  return (
    <section
      aria-label="Aviso de cobrança"
      className={
        emAtraso
          ? 'bg-amber-50 border-b border-amber-200 text-amber-900'
          : 'bg-red-50 border-b border-red-200 md:border-b-0 md:border-l-4 md:border-red-500 text-red-800'
      }
    >
      <div className="max-w-6xl mx-auto px-6 py-3 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <Icone size={20} aria-hidden="true" className={aguardando ? 'shrink-0 mt-0.5 motion-safe:animate-spin' : 'shrink-0 mt-0.5'} />
          <div className="text-sm">
            <div role="status">
              {aguardando ? (
                <>
                  <p className="font-semibold">Aguardando a confirmação do pagamento</p>
                  <p className="mt-1">Pix e cartão costumam confirmar em poucos minutos. Esta tela atualiza sozinha.</p>
                </>
              ) : semConfirmacao ? (
                <p className="font-semibold">
                  Ainda não recebemos a confirmação. Pix e cartão confirmam em poucos minutos. Boleto leva até 3 dias
                  úteis. O acesso volta sozinho quando o pagamento for confirmado.
                </p>
              ) : (
                <>
                  {espera.estado === 'parcial' && espera.vencimentoPago && (
                    <p className="mb-1">
                      Recebemos o pagamento da fatura de {formatarData(espera.vencimentoPago)}. Ainda há outra fatura em atraso.
                    </p>
                  )}
                  <p className="font-semibold">{textoDoEstado(resumo, servicosDoPlano)}</p>
                  {podePagar && <p className="mt-1">{LINHA_DO_BOLETO}</p>}
                </>
              )}
            </div>
            {podePagar && resumo.pode_gerir && !resumo.fatura?.link && (
              <div className="mt-1">
                <LinhaSemLink />
              </div>
            )}
            {emEspera && espera.falhou && (
              <p role="alert" className="mt-1 font-semibold">
                Não foi possível conferir o pagamento agora. Tente de novo em instantes.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2 shrink-0">
          {emEspera && (semConfirmacao || espera.falhou) && (
            <button type="button" onClick={espera.conferirAgora} className={BOTAO_SECUNDARIO}>
              Conferir agora
            </button>
          )}
          <Acao
            resumo={resumo}
            aoPagar={espera.iniciar}
            pagarComoSecundario={emEspera}
          />
        </div>
      </div>
    </section>
  );
}
