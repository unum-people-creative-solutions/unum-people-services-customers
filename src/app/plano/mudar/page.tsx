'use client';

// cobranca-e-plano-do-cliente RF5-03 (BP-T §11.1–§11.4): mudar de plano, só para cima
// (decisão do dono, 10/11). Dados: GET /me/planos, GET /me/faturas (ciclo, forma e próximo
// vencimento) e GET /me/cobranca (situacao, pode_gerir). Chega aqui pelo botão de /plano,
// pelos cartões de /produtos e pelo configurador (?tenant_id=, lido pelo TenantProvider).
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ExternalLink } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import CartaoDePlano, { type BotaoDoCartao } from '@/components/plano/CartaoDePlano';
import ConfirmarPlano from '@/components/plano/ConfirmarPlano';
import { useCobranca } from '@/contexts/CobrancaContext';
import { useTenant } from '@/contexts/TenantContext';
import { useTelaLarga } from '@/hooks/useTelaLarga';
import { textoDoIndisponivel } from '@/lib/planosTexto';
import { FaturasService } from '@/services/cobranca';
import { PlanosService } from '@/services/planos';
import type { PlanoEFaturas } from '@/types/cobranca';
import type { PlanoParaTroca } from '@/types/planos';

type Leitura =
  | { status: 'carregando' }
  | { status: 'pronto'; planos: PlanoParaTroca[]; planoEFaturas: PlanoEFaturas }
  | { status: 'erro' };

const EMAIL = 'atendimento@unumpeople.com.br';

function LinkDoEmail() {
  return (
    <a href={`mailto:${EMAIL}`} className="font-semibold text-brand-blue underline">
      {EMAIL}
    </a>
  );
}

function CartaoCarregando() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
      <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
      <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
      <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  );
}

function MotivoDoIndisponivel({ plano }: { plano: PlanoParaTroca }) {
  if (!plano.indisponivel_por) return null;
  if (plano.indisponivel_por !== 'usuarios_acima_do_limite') {
    return <>{textoDoIndisponivel(plano.indisponivel_por, plano)}</>;
  }
  // Mesmo texto da §11.3, com "Usuários" levando à tela de usuários.
  const [antes, depois] = textoDoIndisponivel(plano.indisponivel_por, plano).split('Usuários');
  return (
    <>
      {antes}
      <a href="/usuarios" className="font-semibold text-brand-blue underline">
        Usuários
      </a>
      {depois}
    </>
  );
}

export default function MudarDePlanoPage() {
  const { activeTenantId, isLoadingTenants } = useTenant();
  const { resumo, carregando, erro: erroDoResumo, recarregar } = useCobranca();
  const telaLarga = useTelaLarga();
  const [leitura, setLeitura] = useState<Leitura>({ status: 'carregando' });
  const [escolhido, setEscolhido] = useState<PlanoParaTroca | null>(null);
  // Só a leitura mais recente mexe no estado: a resposta atrasada de outra empresa é descartada.
  const requisicaoRef = useRef(0);

  // Empresa trocada: os dados da anterior somem já neste render.
  const [tenantVisto, setTenantVisto] = useState(activeTenantId);
  if (activeTenantId !== tenantVisto) {
    setTenantVisto(activeTenantId);
    setLeitura({ status: 'carregando' });
    setEscolhido(null);
  }

  const ler = useCallback(async (tenantId: string) => {
    const requisicao = ++requisicaoRef.current;
    try {
      const [planos, planoEFaturas] = await Promise.all([
        PlanosService.listar(tenantId),
        FaturasService.planoEFaturas(tenantId),
      ]);
      if (requisicao === requisicaoRef.current) setLeitura({ status: 'pronto', planos, planoEFaturas });
    } catch (err) {
      if (requisicao !== requisicaoRef.current) return;
      console.error('Erro ao carregar os planos:', err);
      setLeitura({ status: 'erro' });
    }
  }, []);

  useEffect(() => {
    if (isLoadingTenants || !activeTenantId) return;
    setLeitura({ status: 'carregando' });
    void ler(activeTenantId);
  }, [isLoadingTenants, activeTenantId, ler]);

  const tentarDeNovo = () => {
    if (erroDoResumo) recarregar().catch(() => undefined);
    if (leitura.status === 'erro') {
      setLeitura({ status: 'carregando' });
      void ler(activeTenantId);
    }
  };

  const falhou = erroDoResumo || leitura.status === 'erro';
  const esperando = !falhou && (isLoadingTenants || carregando || !resumo || leitura.status === 'carregando');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      <main aria-busy={esperando ? 'true' : undefined} className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-black text-gray-900">Mudar de plano</h1>
          <p className="text-sm text-gray-500 mt-1">O plano novo vale na hora. O preço novo entra no próximo vencimento.</p>
        </div>

        {falhou ? (
          <div
            role="alert"
            className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex gap-3 items-start shadow-sm"
          >
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} aria-hidden="true" />
            <div>
              <h2 className="font-bold text-red-800 text-sm">Erro</h2>
              <p className="text-sm text-red-700 mt-1">Não foi possível carregar os planos.</p>
              <button
                type="button"
                onClick={tentarDeNovo}
                className="mt-3 min-h-[44px] text-sm font-bold text-red-800 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
                Tentar de novo
              </button>
            </div>
          </div>
        ) : esperando || leitura.status !== 'pronto' || !resumo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CartaoCarregando />
            <CartaoCarregando />
            <CartaoCarregando />
          </div>
        ) : (
          (() => {
            const { planoEFaturas } = leitura;
            const ciclo = planoEFaturas.plano.ciclo;
            const anual = ciclo === 'anual';
            const atual = leitura.planos.find((p) => p.direcao === 'atual');
            // Só o atual e os de cima, em ordem de valor; downgrade nunca aparece (UI-7).
            const visiveis = leitura.planos
              .filter((p) => p.direcao === 'atual' || (!anual && p.direcao === 'upgrade'))
              .sort((a, b) => a.valor - b.valor);
            const temUpgrade = visiveis.some((p) => p.direcao === 'upgrade');
            const emAtraso = resumo.situacao !== 'em_dia';
            const linkDaFatura = resumo.pode_gerir ? resumo.fatura?.link : undefined;

            const botaoDo = (plano: PlanoParaTroca): BotaoDoCartao | null => {
              if (plano.direcao !== 'upgrade' || !resumo.pode_gerir) return null;
              const desabilitadoPor = emAtraso ? (
                'Pague a fatura em atraso para escolher este plano.'
              ) : plano.indisponivel_por ? (
                <MotivoDoIndisponivel plano={plano} />
              ) : null;
              return { desabilitadoPor, aoEscolher: () => setEscolhido(plano) };
            };

            return (
              <>
                {emAtraso && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex flex-wrap items-center gap-3 justify-between">
                    <p className="text-sm font-semibold">Pague a fatura em atraso para mudar de plano.</p>
                    {linkDaFatura && (
                      <a
                        href={linkDaFatura}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-brand-blue text-white rounded-xl font-bold text-sm py-2.5 px-4 hover:brightness-110 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
                      >
                        Pagar fatura <ExternalLink size={16} aria-hidden="true" />
                        <span className="sr-only">(abre em nova aba)</span>
                      </a>
                    )}
                  </div>
                )}
                {!resumo.pode_gerir && (
                  <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl text-gray-800">
                    <p className="text-sm">Só quem gere o contrato pode mudar de plano.</p>
                    <p className="text-sm font-semibold mt-1">Avise o responsável pela conta</p>
                  </div>
                )}

                {atual ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                    {visiveis.map((plano) => (
                      <CartaoDePlano
                        key={plano.slug}
                        plano={plano}
                        atual={atual}
                        ciclo={ciclo}
                        telaLarga={telaLarga}
                        botao={botaoDo(plano)}
                      />
                    ))}
                  </div>
                ) : null}

                {escolhido && atual && (
                  <ConfirmarPlano
                    tenantId={activeTenantId}
                    atual={atual}
                    novo={escolhido}
                    planoDoCliente={planoEFaturas.plano}
                    aoFechar={() => setEscolhido(null)}
                  />
                )}

                <div className="mt-8 space-y-2 text-sm text-gray-700">
                  {anual ? (
                    <p>
                      Seu contrato é anual. Para mudar de plano, escreva para <LinkDoEmail /> e a gente faz a troca para
                      você.
                    </p>
                  ) : (
                    !temUpgrade && <p className="font-semibold">Você já está no maior plano.</p>
                  )}
                  <p>
                    Quer um plano menor? Escreva para <LinkDoEmail /> e a gente faz a troca para você.
                  </p>
                </div>
              </>
            );
          })()
        )}
      </main>
    </div>
  );
}
