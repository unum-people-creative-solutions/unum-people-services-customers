'use client';

// cobranca-e-plano-do-cliente RF4-06 (BP-T §10): reativação pelo cliente da conta fora do
// ar por falta de pagamento. Dados: GET /me/cobranca (useCobranca) e GET /me/faturas (nome
// e ciclo do plano). Destino do botão da faixa em fora_do_ar e dos e-mails de D+30 e D+55.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import ParaVoltar from '@/components/reativar/ParaVoltar';
import { useCobranca } from '@/contexts/CobrancaContext';
import { useTenant } from '@/contexts/TenantContext';
import { FaturasService } from '@/services/cobranca';
import type { PlanoEFaturas } from '@/types/cobranca';

type Leitura = { status: 'carregando' } | { status: 'pronto'; dados: PlanoEFaturas } | { status: 'erro' };

function BlocoCarregando() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
      <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
      <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
      <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  );
}

export default function ReativarPage() {
  const { activeTenantId, isLoadingTenants } = useTenant();
  const { resumo, carregando, erro, recarregar } = useCobranca();
  const [leitura, setLeitura] = useState<Leitura>({ status: 'carregando' });
  // Só a leitura mais recente mexe no estado: a resposta atrasada de outra empresa é descartada.
  const requisicaoRef = useRef(0);

  // Empresa trocada: os dados da anterior somem já neste render.
  const [tenantVisto, setTenantVisto] = useState(activeTenantId);
  if (activeTenantId !== tenantVisto) {
    setTenantVisto(activeTenantId);
    setLeitura({ status: 'carregando' });
  }

  const ler = useCallback(async (tenantId: string) => {
    const requisicao = ++requisicaoRef.current;
    try {
      const dados = await FaturasService.planoEFaturas(tenantId);
      if (requisicao === requisicaoRef.current) setLeitura({ status: 'pronto', dados });
    } catch (err) {
      if (requisicao !== requisicaoRef.current) return;
      console.error('Erro ao ler o plano para a reativação:', err);
      setLeitura({ status: 'erro' });
    }
  }, []);

  useEffect(() => {
    if (isLoadingTenants || !activeTenantId) return;
    setLeitura({ status: 'carregando' });
    void ler(activeTenantId);
  }, [isLoadingTenants, activeTenantId, ler]);

  const tentarDeNovo = () => {
    if (erro) recarregar().catch(() => undefined);
    if (leitura.status === 'erro') {
      setLeitura({ status: 'carregando' });
      void ler(activeTenantId);
    }
  };

  const falhou = erro || leitura.status === 'erro';
  const esperando = !falhou && (isLoadingTenants || carregando || !resumo || leitura.status === 'carregando');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      <main aria-busy={esperando ? 'true' : undefined} className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <h1 className="text-xl font-black text-gray-900 mb-6">Reativar minha conta</h1>

        {falhou ? (
          <div
            role="alert"
            className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex gap-3 items-start shadow-sm"
          >
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} aria-hidden="true" />
            <div>
              <h2 className="font-bold text-red-800 text-sm">Erro</h2>
              <p className="text-sm text-red-700 mt-1">Não foi possível conferir a situação da conta.</p>
              <button
                type="button"
                onClick={tentarDeNovo}
                className="mt-3 min-h-[44px] text-sm font-bold text-red-800 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
                Tentar de novo
              </button>
            </div>
          </div>
        ) : esperando || leitura.status !== 'pronto' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BlocoCarregando />
            <BlocoCarregando />
          </div>
        ) : (
          <ParaVoltar key={activeTenantId} planoEFaturas={leitura.dados} />
        )}
      </main>
    </div>
  );
}
