import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantSwitcher } from './TenantSwitcher';
import { useTenant } from '@/contexts/TenantContext';

// Mock do hook useTenant
vi.mock('@/contexts/TenantContext', () => ({
  useTenant: vi.fn(),
}));

describe('TenantSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('T01 — TenantSwitcher: com 1 tenant ou menos no contexto, não renderiza nada', () => {
    (useTenant as any).mockReturnValue({
      activeTenantId: 'tenant-1',
      availableTenants: [{ id: 'tenant-1', nome_negocio: 'Tenant Um' }],
      isMultiTenant: false,
      switchTenant: vi.fn(),
      isLoadingTenants: false,
    });

    const { container } = render(<TenantSwitcher />);
    expect(container.firstChild).toBeNull();
  });

  it('T02 — TenantSwitcher: com 2+ tenants, renderiza select e permite trocar', async () => {
    const mockSwitch = vi.fn();
    (useTenant as any).mockReturnValue({
      activeTenantId: 'tenant-1',
      availableTenants: [
        { id: 'tenant-1', nome_negocio: 'Tenant Um' },
        { id: 'tenant-2', nome_negocio: 'Tenant Dois' },
      ],
      isMultiTenant: true,
      switchTenant: mockSwitch,
      isLoadingTenants: false,
    });

    const user = userEvent.setup();
    render(<TenantSwitcher />);

    // Deve achar o select/dropdown
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('tenant-1');

    // Trocar a seleção para tenant-2
    await user.selectOptions(select, 'tenant-2');

    // Deve chamar switchTenant com 'tenant-2'
    expect(mockSwitch).toHaveBeenCalledWith('tenant-2');
  });
});
