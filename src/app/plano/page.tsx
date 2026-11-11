'use client';

// cobranca-e-plano-do-cliente RF3-02 (BP-T §9): "Plano e faturas" da empresa ativa,
// lido de GET /me/faturas. A página não decide autorização: mostra o que a API mandou.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import FaturaEmAberto from '@/components/plano/FaturaEmAberto';
import HistoricoDeFaturas from '@/components/plano/HistoricoDeFaturas';
import SeuPlano from '@/components/plano/SeuPlano';
import TrocarFormaDePagamento from '@/components/plano/TrocarFormaDePagamento';
import SubscriptionCancel from '@/components/SubscriptionCancel';
import { useCobranca } from '@/contexts/CobrancaContext';
import { useTenant } from '@/contexts/TenantContext';
import { nomeDaForma } from '@/lib/cobrancaTexto';
import { RESULTADO_D4 } from '@/lib/planosTexto';
import { ehRecusaPorPermissao } from '@/services/api';
import { FaturasService } from '@/services/cobranca';
import { PlanosService } from '@/services/planos';
import type { PlanoEFaturas, SituacaoDeCobranca } from '@/types/cobranca';
import type { FormaDePagamento, PlanoParaTroca } from '@/types/planos';

type Estado =
  | { status: 'carregando' }
  | { status: 'pronto'; dados: PlanoEFaturas }
  | { status: 'erro' }
  | { status: 'proibido' };

// RF6-03 (D-4, resultado B): com fatura em atraso, a forma de pagamento não se troca. A API
// recusa também (409 conta_nao_ativa), mesmo que a tela erre.
// Decisão do executor: fora_do_ar também é atraso por cobrança (as datas do §4.1 vêm nele).
const SITUACOES_EM_ATRASO: SituacaoDeCobranca[] = ['em_atraso', 'bloqueado', 'fora_do_ar'];
const TROCA_EM_ATRASO = 'Pague a fatura em atraso antes de trocar a forma de pagamento.';

function BlocoCarregando() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
      <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
      <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
      <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  );
}

export default function PlanoPage() {
  const { activeTenantId, activeTenantName, isLoadingTenants } = useTenant();
  const { resumo } = useCobranca();
  const [estado, setEstado] = useState<Estado>({ status: 'carregando' });
  // Só a leitura mais recente mexe no estado: a resposta atrasada de outra empresa é descartada.
  const requisicaoRef = useRef(0);
  // cobranca-e-plano-do-cliente RF5-03 (BP-T §11.5, DV-36): plano trocado, gravado pela
  // confirmação da troca. Aparece uma vez e a chave é apagada.
  const [planoTrocado, setPlanoTrocado] = useState<string | null>(null);
  // Fase 5 (RF5-03, BP-T §11.7): planos para a troca, lidos sem segurar a página. Com erro,
  // fica null: o bloco "Seu plano" sai sem a sugestão e sem o botão.
  const [planos, setPlanos] = useState<PlanoParaTroca[] | null>(null);
  const planosRef = useRef(0);
  // Fase 6 (RF6-02, BP-T §12.2): caixa da forma de pagamento e o aviso depois da troca.
  const [trocandoForma, setTrocandoForma] = useState(false);
  const [formaTrocada, setFormaTrocada] = useState<string | null>(null);

  useEffect(() => {
    if (isLoadingTenants || !activeTenantId) return;
    const chave = `plano-trocado:${activeTenantId}`;
    const nome = sessionStorage.getItem(chave);
    if (nome) {
      setPlanoTrocado(nome);
      sessionStorage.removeItem(chave);
    }
  }, [isLoadingTenants, activeTenantId]);

  // Empresa trocada: os dados da anterior somem já neste render.
  const [tenantVisto, setTenantVisto] = useState(activeTenantId);
  if (activeTenantId !== tenantVisto) {
    setTenantVisto(activeTenantId);
    setEstado({ status: 'carregando' });
    setPlanoTrocado(null);
    setPlanos(null);
    setTrocandoForma(false);
    setFormaTrocada(null);
  }

  const lerPlanos = useCallback(async (tenantId: string) => {
    const requisicao = ++planosRef.current;
    try {
      const lista = await PlanosService.listar(tenantId);
      if (requisicao === planosRef.current) setPlanos(lista);
    } catch (err) {
      if (requisicao !== planosRef.current) return;
      console.error('Erro ao ler os planos para a troca:', err);
      setPlanos(null);
    }
  }, []);

  const ler = useCallback(async (tenantId: string) => {
    const requisicao = ++requisicaoRef.current;
    try {
      const dados = await FaturasService.planoEFaturas(tenantId);
      if (requisicao === requisicaoRef.current) setEstado({ status: 'pronto', dados });
    } catch (err) {
      if (requisicao !== requisicaoRef.current) return;
      console.error('Erro ao carregar o plano e as faturas:', err);
      setEstado({ status: ehRecusaPorPermissao(err) ? 'proibido' : 'erro' });
    }
  }, []);

  useEffect(() => {
    if (isLoadingTenants || !activeTenantId) return;
    setEstado({ status: 'carregando' });
    void ler(activeTenantId);
    void lerPlanos(activeTenantId);
  }, [isLoadingTenants, activeTenantId, ler, lerPlanos]);

  // Pagamento confirmado: relê com os dados atuais ainda na tela.
  const relerAposPagamento = useCallback(() => {
    if (activeTenantId) void ler(activeTenantId);
  }, [activeTenantId, ler]);

  // 204: a caixa fecha (o Modal devolve o foco ao botão), a página relê com os dados atuais
  // ainda na tela e mostra o aviso.
  const aoTrocarForma = useCallback(
    (forma: FormaDePagamento) => {
      setTrocandoForma(false);
      setFormaTrocada(nomeDaForma(forma));
      if (activeTenantId) void ler(activeTenantId);
    },
    [activeTenantId, ler],
  );

  const trocaDeFormaBloqueadaPor =
    RESULTADO_D4 === 'B' && resumo !== null && SITUACOES_EM_ATRASO.includes(resumo.situacao) ? TROCA_EM_ATRASO : null;

  const tentarDeNovo = () => {
    setEstado({ status: 'carregando' });
    void ler(activeTenantId);
  };

  const nomeDaEmpresa = activeTenantName || 'empresa';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      <main
        aria-busy={estado.status === 'carregando' ? 'true' : undefined}
        className="flex-1 max-w-5xl w-full mx-auto px-4 py-8"
      >
        <div className="mb-6">
          <h2 className="text-xl font-black text-gray-900">Plano e faturas</h2>
          <p className="text-sm text-gray-500 mt-1">
            O plano da {nomeDaEmpresa}, a próxima fatura e o histórico.
          </p>
        </div>

        {planoTrocado && (
          <div
            role="status"
            className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex gap-3 items-center text-green-800"
          >
            <CheckCircle size={20} aria-hidden="true" className="shrink-0" />
            <p className="text-sm font-semibold">{`Pronto! Sua conta está no plano ${planoTrocado}.`}</p>
          </div>
        )}

        {formaTrocada && (
          <div
            role="status"
            className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex gap-3 items-center text-green-800"
          >
            <CheckCircle size={20} aria-hidden="true" className="shrink-0" />
            <p className="text-sm font-semibold">{`Forma de pagamento trocada para ${formaTrocada}.`}</p>
          </div>
        )}

        {estado.status === 'carregando' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BlocoCarregando />
            <BlocoCarregando />
            <div className="md:col-span-2">
              <BlocoCarregando />
            </div>
          </div>
        ) : estado.status === 'proibido' ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            <p className="text-gray-800">
              Você não pode ver o plano desta empresa. Fale com um administrador do Portal.
            </p>
          </div>
        ) : estado.status === 'erro' ? (
          <div className="flex flex-col gap-6">
            <div
              role="alert"
              className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex gap-3 items-start shadow-sm"
            >
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} aria-hidden="true" />
              <div>
                <h3 className="font-bold text-red-800 text-sm">Erro</h3>
                <p className="text-sm text-red-700 mt-1">Não foi possível carregar o plano e as faturas.</p>
                <button
                  type="button"
                  onClick={tentarDeNovo}
                  className="mt-3 min-h-[44px] text-sm font-bold text-red-800 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                >
                  Tentar de novo
                </button>
              </div>
            </div>
            {/* DV-47: o cancelamento tem a própria leitura; não depende de /me/faturas. */}
            <SubscriptionCancel tenantId={activeTenantId} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <SeuPlano
              plano={estado.dados.plano}
              podeGerir={estado.dados.pode_gerir}
              planos={planos}
              aoTrocarFormaDePagamento={() => {
                setFormaTrocada(null);
                setTrocandoForma(true);
              }}
              trocaDeFormaBloqueadaPor={trocaDeFormaBloqueadaPor}
            />
            <TrocarFormaDePagamento
              aberto={trocandoForma}
              onFechar={() => setTrocandoForma(false)}
              onTrocou={aoTrocarForma}
              tenantId={activeTenantId}
              formaAtual={estado.dados.plano.forma_de_pagamento}
              proximoVencimento={estado.dados.plano.proximo_vencimento}
              faturaAVencer={estado.dados.faturas.find((f) => f.situacao === 'a_vencer')}
              faturaVencida={estado.dados.faturas.find((f) => f.situacao === 'vencida')}
              resultadoD4={RESULTADO_D4}
            />
            <FaturaEmAberto
              faturas={estado.dados.faturas}
              formaDePagamento={estado.dados.plano.forma_de_pagamento}
              aoConfirmarPagamento={relerAposPagamento}
            />
            <div className="md:col-span-2">
              <HistoricoDeFaturas
                faturas={estado.dados.faturas}
                podeGerir={estado.dados.pode_gerir}
                nomeDaEmpresa={nomeDaEmpresa}
              />
            </div>
            {/* BP-T §9.6: o cancelamento veio de /produtos, sem mudança por dentro. */}
            <div className="md:col-span-2">
              <SubscriptionCancel tenantId={activeTenantId} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
