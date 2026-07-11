import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantProvider, useTenant } from './TenantContext';
import { useAuthStore } from '@/store/authStore';
import { TenantService } from '@/services/api';

// Mocks
vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  TenantService: {
    list: vi.fn(),
    getMe: vi.fn(),
  },
  TermsService: {
    getStatus: vi.fn(),
    accept: vi.fn(),
  },
}));

// Test helper component to consume the context
const TestComponent = () => {
  const {
    activeTenantId,
    activeTenantName,
    availableTenants,
    isMultiTenant,
    switchTenant,
    isLoadingTenants,
  } = useTenant();

  return (
    <div>
      <div data-testid="active-id">{activeTenantId}</div>
      <div data-testid="active-name">{activeTenantName}</div>
      <div data-testid="is-multi">{isMultiTenant.toString()}</div>
      <div data-testid="is-loading">{isLoadingTenants.toString()}</div>
      <div data-testid="available-count">{availableTenants.length}</div>
      <button data-testid="switch-btn" onClick={() => switchTenant('tenant-B')}>
        Switch
      </button>
    </div>
  );
};

describe('TenantContext', () => {
  const mockTenants = [
    { id: 'tenant-A', nome_negocio: 'Alpha' },
    { id: 'tenant-B', nome_negocio: 'Beta' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    // Mock do useAuthStore para Customers (sem role/tenantId na session)
    (useAuthStore as any).mockReturnValue({
      session: { email: 'user@test.com', token: 'mock-token' },
    });

    // Mock do list retornando os inquilinos
    (TenantService.list as any).mockResolvedValue(mockTenants);
  });

  it('T01 — TenantContext: inicialização e carregamento com múltiplos tenants', async () => {
    render(
      <TenantProvider>
        <TestComponent />
      </TenantProvider>
    );

    // Deve carregar usando TenantService.list()
    expect(TenantService.list).toHaveBeenCalled();

    // Esperar concluir o carregamento
    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });

    // Como não há sessionStorage, deve assumir o primeiro tenant da lista (tenant-A)
    expect(screen.getByTestId('active-id')).toHaveTextContent('tenant-A');
    expect(screen.getByTestId('active-name')).toHaveTextContent('Alpha');
    expect(screen.getByTestId('is-multi')).toHaveTextContent('true');
    expect(screen.getByTestId('available-count')).toHaveTextContent('2');
  });

  it('T02 — TenantContext: inicialização com 1 único tenant (isMultiTenant = false)', async () => {
    const singleTenant = [{ id: 'tenant-single', nome_negocio: 'Single' }];
    (TenantService.list as any).mockResolvedValue(singleTenant);

    render(
      <TenantProvider>
        <TestComponent />
      </TenantProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('active-id')).toHaveTextContent('tenant-single');
    expect(screen.getByTestId('active-name')).toHaveTextContent('Single');
    expect(screen.getByTestId('is-multi')).toHaveTextContent('false');
    expect(screen.getByTestId('available-count')).toHaveTextContent('1');
  });

  it('T03 — TenantContext: troca de tenant via switchTenant', async () => {
    const user = userEvent.setup();
    render(
      <TenantProvider>
        <TestComponent />
      </TenantProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });

    // Clicar para alternar para tenant-B
    await user.click(screen.getByTestId('switch-btn'));

    // Validar alteração no estado
    expect(screen.getByTestId('active-id')).toHaveTextContent('tenant-B');
    expect(screen.getByTestId('active-name')).toHaveTextContent('Beta');

    // Deve persistir no sessionStorage
    expect(sessionStorage.getItem('active-tenant')).toBe('tenant-B');
  });

  it('T04 — TenantContext: inicializa com tenant salvo no sessionStorage', async () => {
    sessionStorage.setItem('active-tenant', 'tenant-B');

    render(
      <TenantProvider>
        <TestComponent />
      </TenantProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });

    // Deve iniciar com o salvo no sessionStorage, embora o list retorne a mesma lista
    expect(screen.getByTestId('active-id')).toHaveTextContent('tenant-B');
    expect(screen.getByTestId('active-name')).toHaveTextContent('Beta');
  });
});
