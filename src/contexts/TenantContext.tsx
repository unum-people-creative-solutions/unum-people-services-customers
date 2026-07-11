"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { TenantService } from '@/services/api';

interface Tenant {
  id: string;
  nome_negocio: string;
}

interface TenantContextValue {
  activeTenantId: string;
  activeTenantName: string;
  availableTenants: Tenant[];
  isMultiTenant: boolean;
  switchTenant: (id: string) => void;
  isLoadingTenants: boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuthStore();
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);

  // Inicializa activeTenantId preferindo o sessionStorage
  const [activeTenantId, setActiveTenantId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('active-tenant');
      if (saved) return saved;
    }
    return '';
  });

  const loadTenants = useCallback(async () => {
    if (!session?.token) {
      setIsLoadingTenants(false);
      return;
    }
    setIsLoadingTenants(true);
    try {
      const data = await TenantService.list();
      const list = data || [];
      setAvailableTenants(list);

      // Se já temos um activeTenantId, verifica se ele existe na lista.
      // Se não temos activeTenantId ou ele não existe na lista, escolhemos o primeiro disponível.
      if (list.length > 0) {
        const hasActiveInList = list.some((t: Tenant) => t.id === activeTenantId);
        if (!activeTenantId || !hasActiveInList) {
          const firstTenant = list[0];
          setActiveTenantId(firstTenant.id);
        }
      } else {
        setActiveTenantId('');
      }
    } catch (error) {
      console.error('Error loading tenants in context:', error);
    } finally {
      setIsLoadingTenants(false);
    }
  }, [session?.token, activeTenantId]);

  useEffect(() => {
    loadTenants();
  }, [session?.token]); // Dispara no mount ou quando o token mudar

  const switchTenant = useCallback((id: string) => {
    setActiveTenantId(id);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('active-tenant', id);
    }
  }, []);

  const activeTenantName = useMemo(() => {
    const found = availableTenants.find(t => t.id === activeTenantId);
    return found ? found.nome_negocio : '';
  }, [activeTenantId, availableTenants]);

  const isMultiTenant = useMemo(() => {
    return availableTenants.length > 1;
  }, [availableTenants]);

  const value = useMemo<TenantContextValue>(() => ({
    activeTenantId,
    activeTenantName,
    availableTenants,
    isMultiTenant,
    switchTenant,
    isLoadingTenants,
  }), [activeTenantId, activeTenantName, availableTenants, isMultiTenant, switchTenant, isLoadingTenants]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
