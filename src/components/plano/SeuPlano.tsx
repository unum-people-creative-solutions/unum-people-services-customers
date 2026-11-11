'use client';

// cobranca-e-plano-do-cliente RF3-02 (BP-T §9.2): o plano do contrato. Fase 5 (RF5-03,
// §11.7): para quem gere, "Mudar de plano" e a sugestão do próximo plano. Fase 6 (RF6-02,
// §12.1): para quem gere, "Trocar forma de pagamento"; desabilitado sempre com o motivo ao lado.
import { useId } from 'react';
import { CheckCircle } from 'lucide-react';
import { formatarDataCompleta, nomeDaForma, valorDoPlano } from '@/lib/cobrancaTexto';
import { fraseDasDiferencas } from '@/lib/planosTexto';
import type { PlanoDoCliente } from '@/types/cobranca';
import type { PlanoParaTroca } from '@/types/planos';

// Próximo = o upgrade mais barato que pode ser escolhido.
function sugestaoDos(planos: PlanoParaTroca[]): string | null {
  const atual = planos.find((p) => p.direcao === 'atual');
  const proximo = planos
    .filter((p) => p.direcao === 'upgrade' && p.indisponivel_por === null)
    .sort((a, b) => a.valor - b.valor)[0];
  if (!atual || !proximo) return null;
  const frase = fraseDasDiferencas(atual, proximo);
  return frase ? `No plano ${proximo.nome} você ganha ${frase}.` : null;
}

export default function SeuPlano({
  plano,
  podeGerir = false,
  planos = null,
  aoTrocarFormaDePagamento,
  trocaDeFormaBloqueadaPor = null,
}: {
  plano: PlanoDoCliente;
  podeGerir?: boolean;
  // GET /me/planos; null enquanto lê ou quando a leitura falha.
  planos?: PlanoParaTroca[] | null;
  aoTrocarFormaDePagamento?: () => void;
  // Motivo do botão desabilitado (D-4); null com o botão ativo.
  trocaDeFormaBloqueadaPor?: string | null;
}) {
  const tituloId = useId();
  const motivoId = useId();
  // TASK-FIX-F5-02 (§9.2): o link depende só de quem gere; a sugestão depende da leitura.
  const sugestao = podeGerir && planos !== null ? sugestaoDos(planos) : null;
  const mostraTrocaDeForma = podeGerir && aoTrocarFormaDePagamento !== undefined;
  return (
    <section aria-labelledby={tituloId} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h3 id={tituloId} className="text-xl font-black text-gray-900">
        Seu plano
      </h3>
      <p className="text-lg font-bold text-gray-900 mt-3">{plano.nome}</p>
      <p className="text-sm text-gray-700 mt-1">{valorDoPlano(plano.valor, plano.ciclo)}</p>
      {plano.proximo_vencimento && (
        <p className="text-sm text-gray-700 mt-1">
          Próximo vencimento: {formatarDataCompleta(plano.proximo_vencimento)}
        </p>
      )}
      <p className="text-sm text-gray-700 mt-1">Forma de pagamento: {nomeDaForma(plano.forma_de_pagamento)}</p>
      {plano.destaques.length > 0 && (
        <ul aria-label="O que inclui" className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {plano.destaques.map((destaque) => (
            <li key={destaque} className="flex items-center gap-1.5 text-sm text-gray-700">
              <CheckCircle size={16} aria-hidden="true" className="text-green-600 shrink-0" />
              {destaque}
            </li>
          ))}
        </ul>
      )}
      {sugestao && <p className="mt-4 text-sm text-gray-800">{sugestao}</p>}
      {podeGerir && (
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/plano/mudar"
            className="min-h-[44px] inline-flex items-center justify-center bg-brand-blue text-white rounded-xl font-bold text-sm py-2.5 px-4 hover:brightness-110 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
          >
            Mudar de plano
          </a>
          {mostraTrocaDeForma && (
            <button
              type="button"
              onClick={aoTrocarFormaDePagamento}
              disabled={trocaDeFormaBloqueadaPor !== null}
              aria-describedby={trocaDeFormaBloqueadaPor !== null ? motivoId : undefined}
              className="min-h-[44px] inline-flex items-center justify-center border border-gray-300 bg-white rounded-xl text-sm font-bold text-gray-700 py-2.5 px-4 hover:bg-gray-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Trocar forma de pagamento
            </button>
          )}
        </div>
      )}
      {mostraTrocaDeForma && trocaDeFormaBloqueadaPor !== null && (
        <p id={motivoId} className="mt-2 text-sm text-gray-700">
          {trocaDeFormaBloqueadaPor}
        </p>
      )}
    </section>
  );
}
