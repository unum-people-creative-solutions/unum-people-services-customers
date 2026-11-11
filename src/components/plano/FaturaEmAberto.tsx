'use client';

// cobranca-e-plano-do-cliente RF3-02 (BP-T §9.3): a fatura em aberto e o que fazer com
// ela. O link só existe quando a API mandou (pode_gerir); a espera depois de "Pagar
// fatura" é a da faixa (RF2-33, DV-40: as duas instâncias consultam em paralelo).
import { useEffect, useId } from 'react';
import { ExternalLink, Lock, RefreshCw } from 'lucide-react';
import { useCobranca } from '@/contexts/CobrancaContext';
import { useTenant } from '@/contexts/TenantContext';
import { useEsperaDoPagamento } from '@/hooks/useEsperaDoPagamento';
import { formatarDataCompleta, formatarReais, nomeDaSituacaoDaFatura } from '@/lib/cobrancaTexto';
import type { FaturaDoCliente, SituacaoDaFatura } from '@/types/cobranca';

const CLASSE_DO_CHIP: Record<SituacaoDaFatura, string> = {
  a_vencer: 'bg-blue-50 text-brand-blue',
  paga: 'bg-green-50 text-green-800',
  vencida: 'bg-red-50 text-red-800',
  estornada: 'bg-gray-100 text-gray-700',
};

export function ChipDaSituacao({ situacao }: { situacao: SituacaoDaFatura }) {
  return (
    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${CLASSE_DO_CHIP[situacao]}`}>
      {nomeDaSituacaoDaFatura(situacao)}
    </span>
  );
}

const BOTAO_PRIMARIO =
  'min-h-[44px] inline-flex items-center justify-center gap-2 bg-brand-blue text-white rounded-xl font-bold text-sm py-2.5 px-4 hover:brightness-110 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2';

const BOTAO_SECUNDARIO =
  'min-h-[44px] inline-flex items-center justify-center gap-2 border border-gray-300 bg-white rounded-lg text-sm font-bold text-gray-700 px-4 py-2 hover:bg-gray-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue';

// A vencida tem a vez: é a que bloqueia o acesso. Sem ela, a primeira a vencer da lista.
function faturaEmAberto(faturas: FaturaDoCliente[]): FaturaDoCliente | undefined {
  return faturas.find((f) => f.situacao === 'vencida') ?? faturas.find((f) => f.situacao === 'a_vencer');
}

function NovaAba() {
  return (
    <>
      {' '}
      <ExternalLink size={16} aria-hidden="true" />
      <span className="sr-only">(abre em nova aba)</span>
    </>
  );
}

export default function FaturaEmAberto({
  faturas,
  formaDePagamento,
  aoConfirmarPagamento,
}: {
  faturas: FaturaDoCliente[];
  formaDePagamento: string;
  aoConfirmarPagamento: () => void;
}) {
  const tituloId = useId();
  const { activeTenantId } = useTenant();
  const { resumo, recarregar } = useCobranca();
  const espera = useEsperaDoPagamento(activeTenantId, resumo, recarregar);

  // Confirmado (ou pago em parte): a página relê /me/faturas.
  useEffect(() => {
    if (espera.estado === 'confirmado' || espera.estado === 'parcial') aoConfirmarPagamento();
    // Só a mudança de estado dispara a releitura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espera.estado]);

  const fatura = faturaEmAberto(faturas);
  const vencida = fatura?.situacao === 'vencida';
  const noCartao = fatura?.situacao === 'a_vencer' && formaDePagamento === 'CREDIT_CARD';
  const aguardando = vencida && espera.estado === 'aguardando';
  const semConfirmacao = vencida && espera.estado === 'sem_confirmacao';

  let linha = '';
  if (fatura) {
    const valor = formatarReais(fatura.valor);
    const data = formatarDataCompleta(fatura.vencimento);
    if (vencida) linha = `${valor} · venceu em ${data}`;
    else if (noCartao) linha = `${valor} · será cobrada no cartão em ${data}`;
    else linha = `${valor} · vence em ${data}`;
  }

  return (
    <section aria-labelledby={tituloId} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h3 id={tituloId} className="text-xl font-black text-gray-900">
        Fatura em aberto
      </h3>
      {!fatura ? (
        <p className="text-sm text-gray-600 mt-3">Nenhuma fatura em aberto.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-lg font-bold text-gray-900">{linha}</p>
          <div>
            <ChipDaSituacao situacao={fatura.situacao} />
          </div>

          {(aguardando || semConfirmacao) && (
            <div role="status" className="text-sm text-gray-700 flex items-start gap-2">
              {aguardando ? (
                <>
                  <RefreshCw size={16} aria-hidden="true" className="shrink-0 mt-0.5 motion-safe:animate-spin" />
                  <div>
                    <p className="font-semibold">Aguardando a confirmação do pagamento</p>
                    <p className="mt-1">Pix e cartão costumam confirmar em poucos minutos. Esta tela atualiza sozinha.</p>
                  </div>
                </>
              ) : (
                <p className="font-semibold">
                  Ainda não recebemos a confirmação. Pix e cartão confirmam em poucos minutos. Boleto leva até 3 dias
                  úteis. O acesso volta sozinho quando o pagamento for confirmado.
                </p>
              )}
            </div>
          )}
          {(aguardando || semConfirmacao) && espera.falhou && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              Não foi possível conferir o pagamento agora. Tente de novo em instantes.
            </p>
          )}

          {/* A vencer sem link: nenhuma ação, nenhuma linha vazia. */}
          {(fatura.link || vencida) && (
            <div className="flex flex-col sm:flex-row gap-2">
              {(semConfirmacao || (aguardando && espera.falhou)) && (
                <button type="button" onClick={espera.conferirAgora} className={BOTAO_SECUNDARIO}>
                  Conferir agora
                </button>
              )}
              {fatura.link ? (
                noCartao ? (
                  <a href={fatura.link} target="_blank" rel="noopener noreferrer" className={BOTAO_SECUNDARIO}>
                    Ver fatura
                    <NovaAba />
                  </a>
                ) : (
                  <a
                    href={fatura.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={vencida ? () => espera.iniciar(fatura.vencimento) : undefined}
                    className={BOTAO_PRIMARIO}
                  >
                    Pagar fatura
                    <NovaAba />
                  </a>
                )
              ) : vencida ? (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <Lock size={14} aria-hidden="true" className="shrink-0" />
                  Avise o responsável pela conta
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
