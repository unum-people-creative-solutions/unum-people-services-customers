import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notFound } from 'next/navigation';
import type { PlanoParaTroca } from '@/types/planos';
import { basicoDowngrade, captacaoUpgrade, planosSoOAtual, presencaAtual } from '@/test/planosFixtures';
import dados30 from '@/services/__fixtures__/visitas/me-visitas-30.json';
import dados7Vazio from '@/services/__fixtures__/visitas/me-visitas-7-vazio.json';
import dadosBloqueado from '@/services/__fixtures__/visitas/me-visitas-bloqueado.json';
import dados404 from '@/services/__fixtures__/visitas/me-visitas-404.json';

// spec: metricas-de-visitas MV-71 a MV-74, §2.8.1, §2.8.2, T63, T64, CA-MV-32 a CA-MV-36
// (TASK-PORTAL-508). VisitasService e PlanosService são os de verdade; só a rede (axios)
// é dublada, com os arquivos de contrato copiados da API.

const mockGet = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    })),
  },
}));
vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ session: null, logout: vi.fn() }) } }));
vi.mock('@/lib/pkce', () => ({ redirectToHostedUI: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: vi.fn(), usePathname: vi.fn(() => '/visitas') }));
vi.mock('@/components/AppHeader', () => ({ default: () => <header>cabeçalho</header> }));

const tenant = vi.hoisted(() => ({ activeTenantId: 'tenant-padaria', isLoadingTenants: false }));
vi.mock('@/contexts/TenantContext', () => ({ useTenant: () => tenant }));

import VisitasPage from './page';

const NOTA_FIXA =
  "Visitas vindas do WhatsApp quase sempre aparecem como 'Direto': o WhatsApp não diz de onde o visitante veio. Recarregar a página não conta de novo, e robôs conhecidos ficam de fora.";
const FORA_DO_PLANO =
  'A contagem de visitas faz parte dos planos Presença e Captação. Ela começa no dia da troca de plano.';
const SUBTITULO =
  'Quantas vezes a sua página foi aberta, de onde vieram as visitas e quantos toques houve para falar com você. Os números somam todas as páginas da empresa.';

// Cliente no Básico (Página): Presença e Captação são upgrades com a tela.
const basicoAtual: PlanoParaTroca = { ...basicoDowngrade, direcao: 'atual' };
const presencaUpgrade: PlanoParaTroca = { ...presencaAtual, direcao: 'upgrade' };
const planosComUpgrade = { planos: [basicoAtual, presencaUpgrade, captacaoUpgrade] };

function adiada() {
  let resolver!: (valor: unknown) => void;
  let rejeitar!: (erro: unknown) => void;
  const promessa = new Promise((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

// Cada resposta nasce no momento do pedido (uma rejeição criada antes ficaria sem tratamento).
type Resposta = () => Promise<unknown>;
const ok = (data: unknown): Resposta => () => Promise.resolve({ status: 200, data });
const falha = (status: number, data: unknown): Resposta => () => Promise.reject({ response: { status, data } });
const pendente = (promessa: Promise<unknown>): Resposta => () => promessa;

// Fila de respostas por rota, na ordem dos pedidos.
let filaVisitas: Resposta[];
let filaPlanos: Resposta[];

function pedidos(rota: '/me/visitas' | '/me/planos'): string[] {
  return mockGet.mock.calls.map(([url]) => url as string).filter((url) => url.startsWith(rota));
}

async function esperar() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  tenant.activeTenantId = 'tenant-padaria';
  tenant.isLoadingTenants = false;
  filaVisitas = [];
  filaPlanos = [];
  mockGet.mockImplementation((url: string) => {
    const fila = url.startsWith('/me/visitas') ? filaVisitas : filaPlanos;
    const proxima = fila.shift();
    if (!proxima) throw new Error(`pedido sem resposta preparada: ${url}`);
    return proxima();
  });
});

describe('/visitas com dados (T63, CA-MV-32)', () => {
  it('lê GET /me/visitas?periodo=30 da empresa ativa e mostra números, gráfico, listas e a nota', async () => {
    filaVisitas.push(ok(dados30));
    render(<VisitasPage />);
    await esperar();

    expect(pedidos('/me/visitas')).toEqual(['/me/visitas?periodo=30&tenant_id=tenant-padaria']);
    expect(screen.getByRole('heading', { level: 2, name: 'Visitas' })).toBeInTheDocument();
    expect(screen.getByText(SUBTITULO)).toBeInTheDocument();

    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual(['Visitas', 'Toques para falar com você']);
    expect(screen.getAllByRole('definition').map((d) => d.textContent)).toEqual([
      '214',
      '17',
      'Toques no WhatsApp, no telefone e nos botões de contato da página.',
    ]);

    const tabela = screen.getByRole('table', { name: 'Visitas e toques por dia' });
    expect(within(within(tabela).getAllByRole('rowgroup')[1]).getAllByRole('row')).toHaveLength(30);

    const origens = within(screen.getByRole('list', { name: 'De onde vieram' })).getAllByRole('listitem');
    expect(origens[0]).toHaveTextContent(/^Google\s*80\s*37%$/);
    expect(origens[5]).toHaveTextContent(/^Direto ou não identificado\s*58\s*27%$/);
    const aparelhos = within(screen.getByRole('list', { name: 'Aparelho' })).getAllByRole('listitem');
    expect(aparelhos[0]).toHaveTextContent(/^Celular\s*170\s*79%$/);

    expect(screen.getByText(NOTA_FIXA)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('botões "7 dias", "30 dias" e "90 dias" no grupo "Período", com 30 marcado', async () => {
    filaVisitas.push(ok(dados30));
    render(<VisitasPage />);
    await esperar();

    const grupo = screen.getByRole('group', { name: 'Período' });
    const botoes = within(grupo).getAllByRole('button');
    expect(botoes.map((b) => b.textContent)).toEqual(['7 dias', '30 dias', '90 dias']);
    expect(within(grupo).getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(grupo).getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(grupo).getByRole('button', { name: '90 dias' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('troca de período (T63, CA-MV-33)', () => {
  it('"7 dias" pede periodo=7 e passa o aria-pressed; "90 dias" pede periodo=90', async () => {
    const user = userEvent.setup();
    filaVisitas.push(ok(dados30), ok(dados7Vazio), ok(dados30));
    render(<VisitasPage />);
    await esperar();

    await user.click(screen.getByRole('button', { name: '7 dias' }));
    await esperar();
    expect(pedidos('/me/visitas')[1]).toBe('/me/visitas?periodo=7&tenant_id=tenant-padaria');
    expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: '90 dias' }));
    await esperar();
    expect(pedidos('/me/visitas')[2]).toBe('/me/visitas?periodo=90&tenant_id=tenant-padaria');
    expect(screen.getByRole('button', { name: '90 dias' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('a resposta do pedido de 30 que chega depois da de 7 é descartada', async () => {
    const user = userEvent.setup();
    const de7Antigo = adiada();
    const de30Atrasado = adiada();
    const de7Novo = adiada();
    filaVisitas.push(ok(dados30), pendente(de7Antigo.promessa), pendente(de30Atrasado.promessa), pendente(de7Novo.promessa));
    render(<VisitasPage />);
    await esperar();

    await user.click(screen.getByRole('button', { name: '7 dias' }));
    await user.click(screen.getByRole('button', { name: '30 dias' }));
    await user.click(screen.getByRole('button', { name: '7 dias' }));
    expect(pedidos('/me/visitas').slice(1)).toEqual([
      '/me/visitas?periodo=7&tenant_id=tenant-padaria',
      '/me/visitas?periodo=30&tenant_id=tenant-padaria',
      '/me/visitas?periodo=7&tenant_id=tenant-padaria',
    ]);

    await act(async () => de7Novo.resolver({ status: 200, data: dados7Vazio }));
    await act(async () => de30Atrasado.resolver({ status: 200, data: dados30 }));
    await act(async () => de7Antigo.resolver({ status: 200, data: dados30 }));
    await esperar();

    expect(screen.getByText('Nenhuma visita contada nos últimos 7 dias.')).toBeInTheDocument();
    expect(screen.queryByText('214')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('trocar de empresa relê as visitas da empresa nova', async () => {
    filaVisitas.push(ok(dados30), ok(dados7Vazio));
    const { rerender } = render(<VisitasPage />);
    await esperar();

    tenant.activeTenantId = 'tenant-loja';
    rerender(<VisitasPage />);
    await esperar();
    expect(pedidos('/me/visitas')).toEqual([
      '/me/visitas?periodo=30&tenant_id=tenant-padaria',
      '/me/visitas?periodo=30&tenant_id=tenant-loja',
    ]);
  });
});

describe('estados (T64)', () => {
  it('carregando: a seção com aria-busy="true" e "Carregando as visitas…" (CA-MV-36)', async () => {
    filaVisitas.push(pendente(adiada().promessa));
    render(<VisitasPage />);
    await esperar();
    expect(screen.getByRole('region', { name: 'Visitas' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Carregando as visitas…')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('pronto: a seção sai do aria-busy', async () => {
    filaVisitas.push(ok(dados30));
    render(<VisitasPage />);
    await esperar();
    expect(screen.getByRole('region', { name: 'Visitas' })).not.toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Carregando as visitas…')).not.toBeInTheDocument();
  });

  it('sem visitas: me-visitas-7-vazio.json mostra a frase com N = 7, os botões e a nota, sem números, gráfico e listas (CA-MV-34)', async () => {
    const user = userEvent.setup();
    filaVisitas.push(ok(dados30), ok(dados7Vazio));
    render(<VisitasPage />);
    await esperar();
    await user.click(screen.getByRole('button', { name: '7 dias' }));
    await esperar();

    expect(screen.getByText('Nenhuma visita contada nos últimos 7 dias.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Período' })).toBeInTheDocument();
    expect(screen.getByText(NOTA_FIXA)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
    expect(screen.queryByRole('term')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'De onde vieram' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Aparelho' })).not.toBeInTheDocument();
  });

  it('fora do plano com upgrade que tem a tela: texto, "Disponível no plano Presença", nenhum número, nenhum botão de período (CA-MV-35)', async () => {
    filaVisitas.push(ok(dadosBloqueado));
    filaPlanos.push(ok(planosComUpgrade));
    render(<VisitasPage />);
    await esperar();

    expect(pedidos('/me/planos')).toEqual(['/me/planos?tenant_id=tenant-padaria']);
    expect(screen.getByText(FORA_DO_PLANO)).toBeInTheDocument();
    expect(screen.getByText('Disponível no plano Presença')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver planos' })).toHaveAttribute('href', '/plano/mudar');
    expect(screen.queryByRole('group', { name: 'Período' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dias/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('term')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d/)).not.toBeInTheDocument();
  });

  it('fora do plano sem upgrade que tenha a tela (anual ou no maior plano): "Não incluso neste plano"', async () => {
    filaVisitas.push(ok(dadosBloqueado));
    filaPlanos.push(ok(planosSoOAtual));
    render(<VisitasPage />);
    await esperar();

    expect(screen.getByText(FORA_DO_PLANO)).toBeInTheDocument();
    expect(screen.getByText('Não incluso neste plano')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver planos' })).not.toBeInTheDocument();
  });

  it('fora do plano com os planos ilegíveis: alerta, e "Tentar de novo" relê só os planos', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    filaVisitas.push(ok(dadosBloqueado));
    filaPlanos.push(falha(500, { error: 'internal_error' }), ok(planosComUpgrade));
    render(<VisitasPage />);
    await esperar();

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar os planos.');
    expect(screen.getByText(FORA_DO_PLANO)).toBeInTheDocument();
    expect(screen.queryByText('Não incluso neste plano')).not.toBeInTheDocument();

    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    await esperar();
    expect(pedidos('/me/planos')).toHaveLength(2);
    expect(pedidos('/me/visitas')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Disponível no plano Presença')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('404 com me-visitas-404.json: notFound() (CA-MV-36)', async () => {
    filaVisitas.push(falha(404, dados404));
    render(<VisitasPage />);
    await esperar();
    expect(notFound).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(pedidos('/me/planos')).toHaveLength(0);
  });

  it('erro 500: alerta "Não foi possível carregar as visitas." e "Tentar de novo" relê o mesmo período', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    filaVisitas.push(ok(dados30), falha(500, { error: 'internal_error' }), ok(dados30));
    render(<VisitasPage />);
    await esperar();
    await user.click(screen.getByRole('button', { name: '90 dias' }));
    await esperar();

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar as visitas.');
    expect(notFound).not.toHaveBeenCalled();

    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    await esperar();
    expect(pedidos('/me/visitas')).toEqual([
      '/me/visitas?periodo=30&tenant_id=tenant-padaria',
      '/me/visitas?periodo=90&tenant_id=tenant-padaria',
      '/me/visitas?periodo=90&tenant_id=tenant-padaria',
    ]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('214')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('403 com permissao: "Você não tem permissão para fazer isso nesta empresa."', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    filaVisitas.push(falha(403, { error: 'forbidden', permissao: 'portal.empresa.ver' }));
    render(<VisitasPage />);
    await esperar();
    expect(screen.getByText('Você não tem permissão para fazer isso nesta empresa.')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível carregar as visitas.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('espera a lista de empresas antes de ler', async () => {
    tenant.isLoadingTenants = true;
    render(<VisitasPage />);
    await esperar();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
