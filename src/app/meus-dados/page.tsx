'use client';

// dados-do-negocio: página Meus dados (RF-DNG-24, TASK-FE-204).
import { useEffect, useRef, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import SecaoNegocio from '@/components/meus-dados/SecaoNegocio';
import { useTenant } from '@/contexts/TenantContext';
import { NegocioService } from '@/services/meusDados';
import type { DadosDoNegocio } from '@/types/meusDados';

export default function MeusDadosPage() {
  const { activeTenantId, isLoadingTenants } = useTenant();
  const [dadosNegocio, setDadosNegocio] = useState<DadosDoNegocio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (isLoadingTenants || !activeTenantId) return;

    const seq = ++seqRef.current;
    const tenantId = activeTenantId;
    let cancelado = false;
    setCarregando(true);
    setErro(null);

    void (async () => {
      try {
        const resp = await NegocioService.ler(tenantId);
        if (cancelado || seq !== seqRef.current) return;
        setDadosNegocio(resp);
      } catch {
        if (cancelado || seq !== seqRef.current) return;
        setErro('Não foi possível carregar os dados do negócio.');
      } finally {
        if (!cancelado && seq === seqRef.current) {
          setCarregando(false);
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [activeTenantId, isLoadingTenants]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-6xl w-full mx-auto py-8 px-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meus dados</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie os dados da sua conta e do seu negócio
          </p>
        </div>

        {carregando ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="h-8 bg-gray-200 rounded-lg animate-pulse w-1/4" />
            <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        ) : erro ? (
          <div
            role="alert"
            className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium"
          >
            {erro}
          </div>
        ) : dadosNegocio && activeTenantId ? (
          <div className="space-y-8">
            <SecaoNegocio
              dadosIniciais={dadosNegocio}
              tenantId={activeTenantId}
              onSalvo={(atualizado) => setDadosNegocio(atualizado)}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
