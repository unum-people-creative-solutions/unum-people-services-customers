import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { TermStatusItem } from '@/services/api';

// spec: cobranca-e-plano-do-cliente RF5-03, T84 (/termos depois da troca de plano, BP-T
// §11.6, D-2, DV-36): a linha do plano novo vem só do sessionStorage, nunca da URL.

const params = vi.hoisted(() => ({ valores: {} as Record<string, string> }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (chave: string) => params.valores[chave] ?? null }),
  usePathname: () => '/termos',
}));

const termos = vi.hoisted(() => ({ getStatus: vi.fn(), accept: vi.fn() }));
vi.mock('@/services/api', async () => {
  const real = await vi.importActual<typeof import('@/services/api')>('@/services/api');
  return { ...real, TermsService: termos };
});

vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => ({ activeTenantId: 't1', activeTenantName: 'Padaria Zé', isLoadingTenants: false }),
}));
vi.mock('@/components/AppHeader', () => ({ default: () => <header>cabeçalho</header> }));

import TermsPage from './page';

const LINHA = 'Seu plano mudou. Leia e aceite o termo do plano Captação para continuar usando o CRM e o blog.';

const termoDeContratacao: TermStatusItem = {
  type: 'contratacao_servico',
  term_id: 'termo-captacao',
  term_name: 'Contrato do plano Captação',
  required_version: 1,
  can_accept: true,
  document_url: 'https://example.com/termo-captacao.html',
};

describe('/termos depois da troca de plano (T84)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    params.valores = { return_to: '/plano' };
    termos.getStatus.mockResolvedValue({ pending: [termoDeContratacao], accepted: [] });
  });

  it('com a chave do plano novo: mostra a linha no topo e apaga a chave', async () => {
    sessionStorage.setItem('plano-novo:t1', 'Captação');
    render(<TermsPage />);
    expect(await screen.findByText(LINHA)).toBeInTheDocument();
    expect(screen.getByText('Contrato do plano Captação')).toBeInTheDocument();
    expect(sessionStorage.getItem('plano-novo:t1')).toBeNull();
  });

  it('sem a chave: nenhuma linha, mesmo com o nome do plano na URL', async () => {
    params.valores = { return_to: '/plano', plano: 'Captação', plano_novo: 'Captação' };
    render(<TermsPage />);
    expect(await screen.findByText('Contrato do plano Captação')).toBeInTheDocument();
    expect(screen.queryByText(/Seu plano mudou/)).not.toBeInTheDocument();
  });

  it('chave de outra empresa não aparece', async () => {
    sessionStorage.setItem('plano-novo:outra', 'Captação');
    render(<TermsPage />);
    expect(await screen.findByText('Contrato do plano Captação')).toBeInTheDocument();
    expect(screen.queryByText(/Seu plano mudou/)).not.toBeInTheDocument();
    expect(sessionStorage.getItem('plano-novo:outra')).toBe('Captação');
  });

  describe('return_to continua passando por getSafeRedirect', () => {
    let locationOriginal: Location;

    beforeEach(() => {
      locationOriginal = window.location;
      // @ts-expect-error troca a location do jsdom por um objeto que guarda o destino.
      delete window.location;
      // @ts-expect-error idem
      window.location = { href: '' };
      termos.getStatus.mockResolvedValue({ pending: [], accepted: [] });
      sessionStorage.setItem('plano-novo:t1', 'Captação');
    });

    afterEach(() => {
      // @ts-expect-error devolve a location do jsdom.
      window.location = locationOriginal;
    });

    it('sem termo pendente, volta para /plano', async () => {
      render(<TermsPage />);
      await waitFor(() => expect(window.location.href).toBe('/plano'));
    });

    it('destino fora dos domínios da Unum não é seguido', async () => {
      params.valores = { return_to: 'https://exemplo-malicioso.com/plano' };
      render(<TermsPage />);
      expect(await screen.findByText(/Tudo em dia/)).toBeInTheDocument();
      expect(window.location.href).toBe('');
    });
  });
});
