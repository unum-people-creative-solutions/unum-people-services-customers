import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';
import { CobrancaProvider } from '@/contexts/CobrancaContext';
import { CobrancaService } from '@/services/cobranca';
import type { ResumoDeCobranca, SituacaoDasMetricasDeVisitas } from '@/types/cobranca';
import { resumoEmDia } from '@/test/cobrancaFixtures';

// spec: metricas-de-visitas MV-70, T62, CA-MV-31 (TASK-PORTAL-505). O resumo chega pelo
// CobrancaProvider de verdade; só a leitura de GET /me/cobranca é dublada.

const useMeusAcessos = vi.hoisted(() => vi.fn());
const estadoDaSessao = vi.hoisted(() => ({
  session: { email: 'dono@padariaze.com.br', token: 'token' },
  nomeSobrescrito: null,
  logout: () => undefined,
}));

vi.mock('@/hooks/useMeusAcessos', () => ({ useMeusAcessos }));
vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));
vi.mock('@/lib/pkce', () => ({ logoutFromHostedUI: vi.fn() }));
vi.mock('@/services/cobranca', () => ({ CobrancaService: { resumo: vi.fn() } }));
const lerVisitas = vi.hoisted(() => vi.fn());
vi.mock('@/services/visitas', () => ({ VisitasService: { ler: lerVisitas } }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: (seletor?: (estado: typeof estadoDaSessao) => unknown) =>
    seletor ? seletor(estadoDaSessao) : estadoDaSessao,
}));
vi.mock('@/contexts/TenantContext', () => ({
  useTenant: vi.fn(() => ({
    activeTenantId: 'tenant-1',
    availableTenants: [{ id: 'tenant-1', nome_negocio: 'Tenant Um' }],
    isMultiTenant: false,
    switchTenant: vi.fn(),
    isLoadingTenants: false,
  })),
}));

const resumoMock = vi.mocked(CobrancaService.resumo);

function comSituacao(situacao: SituacaoDasMetricasDeVisitas): ResumoDeCobranca {
  return { ...resumoEmDia, metricas_de_visitas: situacao };
}

function montar() {
  return render(
    <CobrancaProvider>
      <AppHeader />
    </CobrancaProvider>,
  );
}

// Espera a leitura do resumo terminar e o provedor gravar o estado.
async function esperarOResumo() {
  await waitFor(() => expect(resumoMock).toHaveBeenCalledWith('tenant-1'));
  await act(async () => {
    await resumoMock.mock.results.at(-1)?.value;
  });
}

describe('AppHeader — item Visitas (T62, CA-MV-31)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue('/produtos');
    useMeusAcessos.mockReturnValue({ podeGerirUsuarios: false, carregando: false, erro: false });
  });

  it('liberado: link "Visitas" para /visitas, sem cadeado, logo depois de Meus Produtos', async () => {
    vi.mocked(usePathname).mockReturnValue('/plano');
    resumoMock.mockResolvedValue(comSituacao('liberado'));
    montar();

    const link = await screen.findByRole('link', { name: 'Visitas' });
    expect(link).toHaveAttribute('href', '/visitas');
    expect(link.querySelector('svg')).toBeNull();

    const nomes = screen.getAllByRole('link').map((l) => l.textContent?.trim());
    expect(nomes[nomes.indexOf('Meus Produtos') + 1]).toBe('Visitas');
  });

  it('bloqueado: link com o cadeado escondido do leitor e o nome "Visitas, fora do seu plano"', async () => {
    resumoMock.mockResolvedValue(comSituacao('bloqueado'));
    montar();

    const link = await screen.findByRole('link', { name: 'Visitas, fora do seu plano' });
    expect(link).toHaveAttribute('href', '/visitas');
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('oculto: sem link', async () => {
    resumoMock.mockResolvedValue(comSituacao('oculto'));
    montar();
    await esperarOResumo();
    expect(screen.getByRole('link', { name: 'Plano e faturas' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /visitas/i })).not.toBeInTheDocument();
  });

  it('campo ausente no resumo: sem link', async () => {
    resumoMock.mockResolvedValue(resumoEmDia);
    montar();
    await esperarOResumo();
    expect(screen.queryByRole('link', { name: /visitas/i })).not.toBeInTheDocument();
  });

  it('resumo carregando: sem link', async () => {
    resumoMock.mockReturnValue(new Promise<ResumoDeCobranca>(() => undefined));
    montar();
    await waitFor(() => expect(resumoMock).toHaveBeenCalledWith('tenant-1'));
    expect(screen.getByRole('link', { name: 'Plano e faturas' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /visitas/i })).not.toBeInTheDocument();
  });

  it('resumo com erro: sem link', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    resumoMock.mockRejectedValue({ response: { status: 500 } });
    montar();
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: /visitas/i })).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('sem provedor: sem link', () => {
    render(<AppHeader />);
    expect(screen.getByRole('link', { name: 'Plano e faturas' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /visitas/i })).not.toBeInTheDocument();
  });

  it('na própria /visitas: sem link, nas duas situações que mostram o item', async () => {
    vi.mocked(usePathname).mockReturnValue('/visitas');
    resumoMock.mockResolvedValue(comSituacao('liberado'));
    const { unmount } = montar();
    await esperarOResumo();
    expect(screen.queryByRole('link', { name: /visitas/i })).not.toBeInTheDocument();
    unmount();

    resumoMock.mockResolvedValue(comSituacao('bloqueado'));
    montar();
    await esperarOResumo();
    expect(screen.queryByRole('link', { name: /visitas/i })).not.toBeInTheDocument();
  });

  it('o cabeçalho só lê o resumo: não chama GET /me/visitas', async () => {
    resumoMock.mockResolvedValue(comSituacao('liberado'));
    montar();
    await screen.findByRole('link', { name: 'Visitas' });
    expect(resumoMock).toHaveBeenCalledTimes(1);
    expect(lerVisitas).not.toHaveBeenCalled();
  });
});
