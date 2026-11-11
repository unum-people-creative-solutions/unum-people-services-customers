'use client';

// cobranca-e-plano-do-cliente RF3-02 (BP-T §9): "Plano e faturas" da empresa ativa,
// lido de GET /me/faturas. A página não decide autorização: mostra o que a API mandou.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import FaturaEmAberto from '@/components/plano/FaturaEmAberto';
import HistoricoDeFaturas from '@/components/plano/HistoricoDeFaturas';
import SeuPlano from '@/components/plano/SeuPlano';
import SubscriptionCancel from '@/components/SubscriptionCancel';
import { useTenant } from '@/contexts/TenantContext';
import { ehRecusaPorPermissao } from '@/services/api';
import { FaturasService } from '@/services/cobranca';
import type { PlanoEFaturas } from '@/types/cobranca';

type Estado =
  | { status: 'carregando' }
  | { status: 'pronto'; dados: PlanoEFaturas }
  | { status: 'erro' }
  | { status: 'proibido' };

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
  const [estado, setEstado] = useState<Estado>({ status: 'carregando' });
  // Só a leitura mais recente mexe no estado: a resposta atrasada de outra empresa é descartada.
  const requisicaoRef = useRef(0);

  // Empresa trocada: os dados da anterior somem já neste render.
  const [tenantVisto, setTenantVisto] = useState(activeTenantId);
  if (activeTenantId !== tenantVisto) {
    setTenantVisto(activeTenantId);
    setEstado({ status: 'carregando' });
  }

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
  }, [isLoadingTenants, activeTenantId, ler]);

  // Pagamento confirmado: relê com os dados atuais ainda na tela.
  const relerAposPagamento = useCallback(() => {
    if (activeTenantId) void ler(activeTenantId);
  }, [activeTenantId, ler]);

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
            <SeuPlano plano={estado.dados.plano} />
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
