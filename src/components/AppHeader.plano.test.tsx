import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePathname } from 'next/navigation';

const useMeusAcessos = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useMeusAcessos', () => ({ useMeusAcessos }));
vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));
vi.mock('@/lib/pkce', () => ({ logoutFromHostedUI: vi.fn() }));
vi.mock('@/contexts/TenantContext', () => ({
  useTenant: vi.fn(() => ({
    activeTenantId: 'tenant-1',
    availableTenants: [{ id: 'tenant-1', nome_negocio: 'Padaria Zé' }],
    isMultiTenant: false,
    switchTenant: vi.fn(),
    isLoadingTenants: false,
  })),
}));

import AppHeader from './AppHeader';

// spec: cobranca-e-plano-do-cliente RF3-02, T58 (BP-T §9): link "Plano e faturas" para
// todo mundo da empresa, depois de "Meus Produtos", e some na própria página.
describe('AppHeader — link Plano e faturas (T58)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMeusAcessos.mockReturnValue({ podeGerirUsuarios: true, carregando: false, erro: false });
  });

  it('mostra o link para /plano logo depois de "Meus Produtos"', () => {
    vi.mocked(usePathname).mockReturnValue('/termos');
    render(<AppHeader />);
    const plano = screen.getByRole('link', { name: 'Plano e faturas' });
    expect(plano).toHaveAttribute('href', '/plano');
    const nomes = screen.getAllByRole('link').map((link) => link.textContent);
    expect(nomes.indexOf('Plano e faturas')).toBe(nomes.indexOf('Meus Produtos') + 1);
  });

  it('em /plano, o link some como os outros', () => {
    vi.mocked(usePathname).mockReturnValue('/plano');
    render(<AppHeader />);
    expect(screen.queryByRole('link', { name: 'Plano e faturas' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Meus Produtos' })).toBeInTheDocument();
  });

  it('aparece também para quem não gere usuários', () => {
    vi.mocked(usePathname).mockReturnValue('/produtos');
    useMeusAcessos.mockReturnValue({ podeGerirUsuarios: false, carregando: false, erro: false });
    render(<AppHeader />);
    expect(screen.getByRole('link', { name: 'Plano e faturas' })).toHaveAttribute('href', '/plano');
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();
  });
});
