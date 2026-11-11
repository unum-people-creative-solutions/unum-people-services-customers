'use client';

// cobranca-e-plano-do-cliente RF4-06 (BP-T §10.1, §10.2): o que a conta precisa para voltar
// e o que acontece depois. A tela não decide se a conta pode ser reativada: mostra o que o
// resumo (GET /me/cobranca) disse e o que POST /me/reativacao respondeu.
import { useId, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, ExternalLink, Lock, RefreshCw } from 'lucide-react';
import { useCobranca } from '@/contexts/CobrancaContext';
import { useTenant } from '@/contexts/TenantContext';
import { useEsperaDoPagamento } from '@/hooks/useEsperaDoPagamento';
import { ferramentasCitadas, formatarData, formatarReais } from '@/lib/cobrancaTexto';
import { ehRecusaPorPermissao, MENSAGEM_SEM_PERMISSAO } from '@/services/api';
import { ReativacaoService } from '@/services/cobranca';
import type { PlanoEFaturas } from '@/types/cobranca';

const EMAIL_DO_ATENDIMENTO = 'atendimento@unumpeople.com.br';
const PAGINAS_URL = 'https://unumpeople.app/minha-conta';

const BOTAO_PRIMARIO =
  'w-full md:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 bg-brand-blue text-white rounded-xl font-bold text-sm py-2.5 px-4 hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2';

const BOTAO_SECUNDARIO =
  'w-full md:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 border border-gray-300 bg-white rounded-lg text-sm font-bold text-gray-700 px-4 py-2 hover:bg-gray-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue';

type ErroDoPedido = 'nao_pausada' | 'cancelamento_pedido' | 'sem_permissao' | 'outro';

type Pedido =
  | { estado: 'parado' }
  | { estado: 'gerando' }
  | { estado: 'gerada'; valor: number; vencimento: string; link: string }
  | { estado: 'erro'; erro: ErroDoPedido };

function Caixa({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">{children}</div>;
}

function Email() {
  return (
    <a href={`mailto:${EMAIL_DO_ATENDIMENTO}`} className="font-semibold underline">
      {EMAIL_DO_ATENDIMENTO}
    </a>
  );
}

function TextoNaoPode() {
  return (
    <>
      Esta conta não pode ser reativada por aqui. Escreva para <Email />.
    </>
  );
}

function MensagemDoErro({ erro }: { erro: ErroDoPedido }) {
  switch (erro) {
    case 'nao_pausada':
      return <TextoNaoPode />;
    case 'cancelamento_pedido':
      return (
        <>
          Há um pedido de cancelamento nesta conta. Escreva para <Email /> para reativar.
        </>
      );
    case 'sem_permissao':
      return <>{MENSAGEM_SEM_PERMISSAO}</>;
    default:
      return <>Não foi possível gerar a fatura agora. Nada foi cobrado. Tente de novo em alguns minutos.</>;
  }
}

function AviseOResponsavel() {
  return (
    <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
      <Lock size={14} aria-hidden="true" className="shrink-0" />
      Avise o responsável pela conta
    </p>
  );
}

export default function ParaVoltar({ planoEFaturas }: { planoEFaturas: PlanoEFaturas }) {
  const { resumo, recarregar } = useCobranca();
  const { activeTenantId } = useTenant();
  const espera = useEsperaDoPagamento(activeTenantId, resumo, recarregar);
  const [pedido, setPedido] = useState<Pedido>({ estado: 'parado' });
  // Duplo clique gera uma chamada só (DV-45): o botão desabilita e a trava fica até a resposta.
  const enviandoRef = useRef(false);
  // A conta estava fora do ar nesta visita: em_dia depois disso é a reativação confirmada.
  const [viuForaDoAr, setViuForaDoAr] = useState(false);
  if (resumo?.situacao === 'fora_do_ar' && !viuForaDoAr) setViuForaDoAr(true);
  const cartaoId = useId();
  const depoisId = useId();
  const dominioId = useId();
  // 409 nao_pausada: o resumo estava velho (ex.: o operador já reativou). A tela relê e mostra o
  // que o resumo novo disser, sem oferecer gerar de novo (Verifier F4 L8).
  const naoPausada = pedido.estado === 'erro' && pedido.erro === 'nao_pausada';

  if (!resumo) return null;

  if (resumo.situacao === 'em_dia' && viuForaDoAr && !naoPausada) {
    return (
      <div className="bg-green-50 border border-green-200 text-green-800 rounded-2xl p-6 flex items-start gap-3">
        <CheckCircle size={20} aria-hidden="true" className="shrink-0 mt-0.5" />
        <div className="flex-1">
          <div role="status">
            <p className="font-semibold">Conta reativada. Sua página está no ar de novo.</p>
          </div>
          <p className="text-sm mt-1">Se você usava um domínio próprio, ligue de novo em Páginas › Domínio próprio.</p>
          <a href={PAGINAS_URL} className={`${BOTAO_PRIMARIO} mt-4`}>
            Abrir Páginas
          </a>
        </div>
      </div>
    );
  }

  if (resumo.situacao === 'em_dia') {
    return (
      <Caixa>
        <p className="text-gray-800">Sua conta está ativa. Não há nada para reativar.</p>
        <a href="/produtos" className={`${BOTAO_SECUNDARIO} mt-4`}>
          Ir para Meus Produtos
        </a>
      </Caixa>
    );
  }

  // Fase 7 (spec-f7 RF7-08, DV-53): em atraso sem fatura para pagar, com `reativacao` no resumo.
  // A página continua no ar: sem "Sua página volta ao ar.", sem o aviso do domínio e sem
  // "A fatura antiga não é cobrada.".
  const semFatura =
    (resumo.situacao === 'em_atraso' || resumo.situacao === 'bloqueado') &&
    resumo.fatura === null &&
    resumo.reativacao !== undefined;

  if (resumo.situacao !== 'fora_do_ar' && !semFatura) {
    return (
      <Caixa>
        <p className="text-gray-800">
          <TextoNaoPode />
        </p>
      </Caixa>
    );
  }

  const { plano } = planoEFaturas;
  const anual = plano.ciclo === 'anual';
  const valor = resumo.reativacao?.valor ?? plano.valor;

  // Fatura de reativação: a que o POST devolveu ou a já pendente que o resumo mandou (só com
  // pode_gerir). O vencimento da pendente vem do mesmo registro em /me/faturas, pelo link.
  const linkPendente = resumo.pode_gerir ? resumo.reativacao?.link ?? null : null;
  const fatura =
    pedido.estado === 'gerada'
      ? { valor: pedido.valor, vencimento: pedido.vencimento, link: pedido.link }
      : linkPendente
        ? {
            valor,
            vencimento: planoEFaturas.faturas.find((f) => f.link === linkPendente)?.vencimento,
            link: linkPendente,
          }
        : null;

  const gerando = pedido.estado === 'gerando';
  const aguardando = fatura !== null && espera.estado === 'aguardando';
  const semConfirmacao = fatura !== null && espera.estado === 'sem_confirmacao';

  const gerar = async () => {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setPedido({ estado: 'gerando' });
    try {
      const resultado = await ReativacaoService.pedir(activeTenantId);
      if ('tipo' in resultado) {
        setPedido({ estado: 'erro', erro: resultado.tipo });
        if (resultado.tipo === 'nao_pausada') recarregar().catch(() => undefined);
      } else {
        setPedido({ estado: 'gerada', ...resultado });
      }
    } catch (err) {
      console.error('Erro ao gerar a fatura de reativação:', err);
      setPedido({ estado: 'erro', erro: ehRecusaPorPermissao(err) ? 'sem_permissao' : 'outro' });
    } finally {
      enviandoRef.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {semFatura ? (
        <p className="text-gray-800">
          Não encontramos uma fatura em aberto desta conta. Gere a fatura de {formatarReais(valor)} para pagar e
          liberar o acesso.
        </p>
      ) : (
        <p className="text-gray-800">
          Sua página está fora do ar por falta de pagamento. A conta será cancelada em{' '}
          {resumo.cancelamento_em ? formatarData(resumo.cancelamento_em) : ''}.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <section
          aria-labelledby={cartaoId}
          aria-busy={gerando ? 'true' : undefined}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6"
        >
          <h2 id={cartaoId} className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Para voltar
          </h2>
          <p className="text-3xl font-black text-gray-900 mt-2">{formatarReais(valor)}</p>
          <p className="text-sm text-gray-700 mt-2">
            {anual ? `Uma anuidade do plano ${plano.nome}.` : `Uma mensalidade do plano ${plano.nome}.`}
          </p>
          {!semFatura && <p className="text-sm text-gray-700">A fatura antiga não é cobrada.</p>}

          {!resumo.pode_gerir ? (
            <div className="mt-4">
              <AviseOResponsavel />
            </div>
          ) : fatura ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-900">
                {fatura.vencimento
                  ? `Fatura de reativação de ${formatarReais(fatura.valor)}, vence em ${formatarData(fatura.vencimento)}.`
                  : `Fatura de reativação de ${formatarReais(fatura.valor)}.`}
              </p>
              {(aguardando || semConfirmacao) && (
                <div role="status" className="text-sm text-gray-700 flex items-start gap-2">
                  {aguardando ? (
                    <>
                      <RefreshCw size={16} aria-hidden="true" className="shrink-0 mt-0.5 motion-safe:animate-spin" />
                      <div>
                        <p className="font-semibold">Aguardando a confirmação do pagamento</p>
                        <p className="mt-1">
                          Pix e cartão costumam confirmar em poucos minutos. Esta tela atualiza sozinha.
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="font-semibold">
                      Ainda não recebemos a confirmação. Pix e cartão confirmam em poucos minutos. Boleto leva até 3
                      dias úteis. O acesso volta sozinho quando o pagamento for confirmado.
                    </p>
                  )}
                </div>
              )}
              {(aguardando || semConfirmacao) && espera.falhou && (
                <p role="alert" className="text-sm font-semibold text-red-700">
                  Não foi possível conferir o pagamento agora. Tente de novo em instantes.
                </p>
              )}
              <div className="flex flex-col md:flex-row gap-2">
                {(semConfirmacao || (aguardando && espera.falhou)) && (
                  <button type="button" onClick={espera.conferirAgora} className={BOTAO_SECUNDARIO}>
                    Conferir agora
                  </button>
                )}
                <a
                  href={fatura.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => espera.iniciar(fatura.vencimento ?? '')}
                  className={aguardando || semConfirmacao ? BOTAO_SECUNDARIO : BOTAO_PRIMARIO}
                >
                  Pagar fatura
                  <ExternalLink size={16} aria-hidden="true" />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {pedido.estado === 'erro' && (
                <p role="alert" className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-sm text-red-800">
                  <MensagemDoErro erro={pedido.erro} />
                </p>
              )}
              {!naoPausada && (
                <button type="button" onClick={gerar} disabled={gerando} className={BOTAO_PRIMARIO}>
                  {gerando ? (
                    <>
                      <RefreshCw size={16} aria-hidden="true" className="motion-safe:animate-spin" />
                      Gerando a fatura…
                    </>
                  ) : (
                    'Gerar a fatura de reativação'
                  )}
                </button>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby={depoisId} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 id={depoisId} className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Depois de pagar
          </h2>
          <ul className="mt-3 list-disc pl-5 space-y-2 text-sm text-gray-800">
            {!semFatura && <li>Sua página volta ao ar.</li>}
            {resumo.situacao !== 'em_atraso' && (
              <li>{ferramentasCitadas(resumo.ferramentas_bloqueadas)} voltam a funcionar.</li>
            )}
            <li>
              Um novo ciclo começa no dia do pagamento. A próxima fatura vence em {anual ? 'um ano' : 'um mês'}.
            </li>
          </ul>
        </section>
      </div>

      {!semFatura && (
        <section
          aria-labelledby={dominioId}
          className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex items-start gap-3"
        >
          <AlertTriangle size={20} aria-hidden="true" className="shrink-0 mt-0.5" />
          <div>
            <h2 id={dominioId} className="font-bold text-sm">
              Domínio próprio
            </h2>
            <p className="text-sm mt-1">
              Se você usava um domínio próprio, ele foi desligado quando a página saiu do ar. Depois de reativar, ligue
              de novo em Páginas › Domínio próprio.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
