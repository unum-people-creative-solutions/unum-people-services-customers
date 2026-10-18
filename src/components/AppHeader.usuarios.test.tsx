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
    availableTenants: [{ id: 'tenant-1', nome_negocio: 'Loja da Ana' }],
    isMultiTenant: false,
    switchTenant: vi.fn(),
    isLoadingTenants: false,
  })),
}));

import AppHeader from './AppHeader';

// gestao-de-acesso-f3-portal-cliente RF-16, CA-09: o link Usuários só para quem pode gerir.
describe('AppHeader — link Usuários', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue('/produtos');
  });

  it('com a permissão, mostra o link para /usuarios da empresa ativa', () => {
    useMeusAcessos.mockReturnValue({ podeGerirUsuarios: true, carregando: false, erro: false });
    render(<AppHeader />);
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/usuarios');
    expect(useMeusAcessos).toHaveBeenCalledWith('tenant-1');
  });

  it('sem a permissão, enquanto carrega ou com erro, não mostra', () => {
    for (const estado of [
      { podeGerirUsuarios: false, carregando: false, erro: false },
      { podeGerirUsuarios: false, carregando: true, erro: false },
      { podeGerirUsuarios: false, carregando: false, erro: true },
    ]) {
      useMeusAcessos.mockReturnValue(estado);
      const { unmount } = render(<AppHeader />);
      expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('na própria página, o link some como os outros', () => {
    vi.mocked(usePathname).mockReturnValue('/usuarios');
    useMeusAcessos.mockReturnValue({ podeGerirUsuarios: true, carregando: false, erro: false });
    render(<AppHeader />);
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Meus Produtos' })).toBeInTheDocument();
  });
});
