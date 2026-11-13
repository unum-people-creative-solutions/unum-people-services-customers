"use client";

// cobranca-e-plano-do-cliente RF2-31: resumo de cobrança da empresa ativa, lido
// uma vez por empresa e compartilhado pela faixa e por /produtos.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';
import { useAuthStore } from '@/store/authStore';
import { CobrancaService } from '@/services/cobranca';
import type { ResumoDeCobranca } from '@/types/cobranca';
import FaixaDeCobranca from '@/components/FaixaDeCobranca';

interface CobrancaContextValue {
  resumo: ResumoDeCobranca | null;
  carregando: boolean;
  // Leitura falhou e não há resumo para mostrar.
  erro: boolean;
  // Relê o resumo. Rejeita quando a leitura falha; com um resumo já na tela, ele fica.
  recarregar: () => Promise<void>;
}

interface Estado {
  resumo: ResumoDeCobranca | null;
  carregando: boolean;
  erro: boolean;
}

const CobrancaContext = createContext<CobrancaContextValue | undefined>(undefined);

export const CobrancaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeTenantId, isLoadingTenants } = useTenant();
  const { session } = useAuthStore();
  const token = session?.token;
  const pathname = usePathname();
  const [estado, setEstado] = useState<Estado>({ resumo: null, carregando: true, erro: false });
  // Cada leitura recebe um número; só a mais recente mexe no estado (a de outra empresa é descartada).
  const requisicaoRef = useRef(0);

  const ler = useCallback(async (tenantId: string) => {
    const requisicao = ++requisicaoRef.current;
    try {
      const resumo = await CobrancaService.resumo(tenantId);
      if (requisicao === requisicaoRef.current) setEstado({ resumo, carregando: false, erro: false });
    } catch (err) {
      if (requisicao === requisicaoRef.current) {
        console.error('Erro ao ler o resumo de cobrança:', err);
        setEstado((anterior) => ({ resumo: anterior.resumo, carregando: false, erro: anterior.resumo === null }));
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    if (isLoadingTenants) return;
    if (!token || !activeTenantId) {
      requisicaoRef.current++;
      setEstado({ resumo: null, carregando: false, erro: false });
      return;
    }
    setEstado({ resumo: null, carregando: true, erro: false });
    ler(activeTenantId).catch(() => undefined);
  }, [isLoadingTenants, activeTenantId, token, ler]);

  const recarregar = useCallback(async () => {
    if (!token || !activeTenantId) return;
    await ler(activeTenantId);
  }, [token, activeTenantId, ler]);

  const value = useMemo<CobrancaContextValue>(() => ({ ...estado, recarregar }), [estado, recarregar]);

  // A faixa fica acima de toda página, menos no retorno do login (RF2-32).
  return (
    <CobrancaContext.Provider value={value}>
      {pathname !== '/auth/callback' && <FaixaDeCobranca />}
      {children}
    </CobrancaContext.Provider>
  );
};

export const useCobranca = () => {
  const context = useContext(CobrancaContext);
  if (context === undefined) {
    throw new Error('useCobranca must be used within a CobrancaProvider');
  }
  return context;
};
