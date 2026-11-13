import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';

const useMeusAcessos = vi.hoisted(() => vi.fn());
const useCobranca = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useMeusAcessos', () => ({ useMeusAcessos }));
vi.mock('@/contexts/CobrancaContext', () => ({
  useCobranca,
}));
vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));
vi.mock('@/lib/pkce', () => ({ logoutFromHostedUI: vi.fn() }));
vi.mock('@/contexts/TenantContext', () => ({
  useTenant: vi.fn(() => ({
    activeTenantId: 'tenant-1',
    availableTenants: [{ id: 'tenant-1', nome_negocio: 'Tenant Um' }],
    isMultiTenant: false,
    switchTenant: vi.fn(),
    isLoadingTenants: false,
  })),
}));

describe('AppHeader — item Meus dados e alerta (TASK-FE-204, RF-DNG-24, T19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue('/produtos');
    useMeusAcessos.mockReturnValue({ podeGerirUsuarios: true, carregando: false, erro: false });
    useCobranca.mockReturnValue({ resumo: null });
  });

  it('mostra o link Meus dados depois de Usuários', () => {
    render(<AppHeader />);
    const links = screen.getAllByRole('link');
    const nomes = links.map((link) => link.textContent?.trim());

    const idxUsuarios = nomes.findIndex((n) => n?.includes('Usuários'));
    const idxMeusDados = nomes.findIndex((n) => n?.includes('Meus dados'));

    expect(idxUsuarios).toBeGreaterThanOrEqual(0);
    expect(idxMeusDados).toBeGreaterThan(idxUsuarios);
    expect(screen.getByRole('link', { name: /^meus dados$/i })).toHaveAttribute(
      'href',
      '/meus-dados',
    );
  });

  it('T19 — com endereco_pendente: true no resumo de cobranca, o link inclui "falta o endereço"', () => {
    useCobranca.mockReturnValue({
      resumo: { endereco_pendente: true },
    });

    render(<AppHeader />);

    const linkComAlerta = screen.getByRole('link', {
      name: /meus dados.*falta o endereço/i,
    });
    expect(linkComAlerta).toHaveAttribute('href', '/meus-dados');
  });

  it('na própria página /meus-dados, o link some como os outros', () => {
    vi.mocked(usePathname).mockReturnValue('/meus-dados');
    render(<AppHeader />);
    expect(screen.queryByRole('link', { name: /meus dados/i })).not.toBeInTheDocument();
  });
});
