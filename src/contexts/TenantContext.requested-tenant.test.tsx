import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSearchParams } from 'next/navigation';
import { TenantProvider, useTenant } from './TenantContext';
import { useAuthStore } from '@/store/authStore';
import { TenantService } from '@/services/api';

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  TenantService: {
    list: vi.fn(),
    getMe: vi.fn(),
  },
}));

const TestComponent = () => {
  const { activeTenantId, activeTenantName, isLoadingTenants } = useTenant();
  return (
    <div>
      <div data-testid="active-id">{activeTenantId}</div>
      <div data-testid="active-name">{activeTenantName}</div>
      <div data-testid="is-loading">{isLoadingTenants.toString()}</div>
    </div>
  );
};

const withTenantParam = (tenantId: string | null) => ({
  get: (key: string) => (key === 'tenant_id' ? tenantId : null),
});

const tenants = [
  { id: 't-1', nome_negocio: 'Empresa Um' },
  { id: 't-2', nome_negocio: 'Empresa Dois' },
];

const renderProvider = () =>
  render(
    <TenantProvider>
      <TestComponent />
    </TenantProvider>
  );

describe('TenantContext — tenant_id pedido pela URL (RF-02 / CA-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    (useAuthStore as any).mockReturnValue({
      session: { email: 'user@test.com', token: 'mock-token' },
    });
    (TenantService.list as any).mockResolvedValue(tenants);
  });

  it('tenant_id na lista vira o ativo, em vez do primeiro da lista', async () => {
    (useSearchParams as any).mockReturnValue(withTenantParam('t-2'));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('active-id')).toHaveTextContent('t-2');
    expect(screen.getByTestId('active-name')).toHaveTextContent('Empresa Dois');
  });

  it('tenant_id na lista tem prioridade sobre o ativo guardado no sessionStorage', async () => {
    sessionStorage.setItem('active-tenant', 't-1');
    (useSearchParams as any).mockReturnValue(withTenantParam('t-2'));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('active-id')).toHaveTextContent('t-2');
    // Sobrevive a um recarregamento total (ex.: link "Ir para Meus Produtos")
    expect(sessionStorage.getItem('active-tenant')).toBe('t-2');
  });

  it('tenant_id fora da lista é ignorado: segue o primeiro da lista', async () => {
    (useSearchParams as any).mockReturnValue(withTenantParam('t-9'));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('active-id')).toHaveTextContent('t-1');
    expect(sessionStorage.getItem('active-tenant')).not.toBe('t-9');
  });

  it('tenant_id fora da lista é ignorado: o ativo guardado válido continua valendo', async () => {
    sessionStorage.setItem('active-tenant', 't-2');
    (useSearchParams as any).mockReturnValue(withTenantParam('t-9'));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('active-id')).toHaveTextContent('t-2');
  });

  it('sem tenant_id na URL mantém a regra atual (primeiro da lista)', async () => {
    (useSearchParams as any).mockReturnValue(withTenantParam(null));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('active-id')).toHaveTextContent('t-1');
  });

  it('login no meio do caminho: tenant_id que chega depois da primeira carga também vale', async () => {
    // O provider monta no /auth/callback (sem tenant_id) e a navegação para
    // /termos?tenant_id=t-2 acontece depois.
    (useSearchParams as any).mockReturnValue(withTenantParam(null));
    const view = renderProvider();
    await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('active-id')).toHaveTextContent('t-1');

    (useSearchParams as any).mockReturnValue(withTenantParam('t-2'));
    view.rerender(
      <TenantProvider>
        <TestComponent />
      </TenantProvider>
    );

    await waitFor(() => expect(screen.getByTestId('active-id')).toHaveTextContent('t-2'));
  });

  it('login no meio do caminho: resposta antiga da lista não sobrescreve o tenant pedido', async () => {
    let resolveFirst!: (value: typeof tenants) => void;
    (TenantService.list as any)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValue(tenants);

    (useSearchParams as any).mockReturnValue(withTenantParam(null));
    const view = renderProvider();

    (useSearchParams as any).mockReturnValue(withTenantParam('t-2'));
    view.rerender(
      <TenantProvider>
        <TestComponent />
      </TenantProvider>
    );
    await waitFor(() => expect(screen.getByTestId('active-id')).toHaveTextContent('t-2'));

    // A primeira chamada (sem tenant pedido) só responde agora.
    resolveFirst(tenants);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId('active-id')).toHaveTextContent('t-2');
  });
});
