import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PlanoEFaturas, ResumoDeCobranca } from '@/types/cobranca';
import {
  planoEFaturasDaPadaria,
  planoEFaturasDaPadariaSemGerir,
  resumoEmAtraso,
  resumoEmDia,
} from '@/test/cobrancaFixtures';
import { simularTela } from '@/test/telaLarga';

// spec: cobranca-e-plano-do-cliente RF3-02, T54 (estrutura e estados, BP-T §9.1 e §9.5)
// e T55 ("Seu plano", BP-T §9.2).

const servico = vi.hoisted(() => ({ planoEFaturas: vi.fn() }));
vi.mock('@/services/cobranca', () => ({ FaturasService: servico }));

const tenant = vi.hoisted(() => ({
  activeTenantId: '3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b',
  activeTenantName: 'Padaria Zé',
  isLoadingTenants: false,
}));
vi.mock('@/contexts/TenantContext', () => ({ useTenant: () => tenant }));
vi.mock('@/components/AppHeader', () => ({ default: () => <header>cabeçalho</header> }));

const cobranca = vi.hoisted(() => ({
  resumo: null as ResumoDeCobranca | null,
  carregando: false,
  erro: false,
  recarregar: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/contexts/CobrancaContext', () => ({ useCobranca: () => cobranca }));

import PlanoPage from './page';

const ID_DA_PADARIA = '3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b';

function adiada<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

describe('/plano: estrutura e estados (T54)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simularTela(true);
    tenant.activeTenantId = ID_DA_PADARIA;
    tenant.activeTenantName = 'Padaria Zé';
    tenant.isLoadingTenants = false;
    servico.planoEFaturas.mockResolvedValue(planoEFaturasDaPadaria);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('mostra o título e as seções da página com os dados da empresa ativa', async () => {
    render(<PlanoPage />);
    expect(await screen.findByRole('heading', { name: 'Seu plano' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plano e faturas' })).toBeInTheDocument();
    expect(screen.getByText('O plano da Padaria Zé, a próxima fatura e o histórico.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fatura em aberto' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Histórico de faturas' })).toBeInTheDocument();
    expect(servico.planoEFaturas).toHaveBeenCalledWith(ID_DA_PADARIA);
    expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy', 'true');
  });

  it('carregando: main com aria-busy="true" e nenhuma seção', () => {
    servico.planoEFaturas.mockReturnValue(new Promise(() => {}));
    render(<PlanoPage />);
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('heading', { name: 'Plano e faturas' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Seu plano' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Fatura em aberto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Histórico de faturas' })).not.toBeInTheDocument();
  });

  it('não lê antes de a lista de empresas carregar', () => {
    tenant.isLoadingTenants = true;
    render(<PlanoPage />);
    expect(servico.planoEFaturas).not.toHaveBeenCalled();
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  });

  it('erro: alerta com a mensagem, nenhuma seção vazia, e "Tentar de novo" relê', async () => {
    servico.planoEFaturas.mockRejectedValueOnce({ response: { status: 500, data: { error: 'internal_error' } } });
    render(<PlanoPage />);
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar o plano e as faturas.');
    expect(screen.queryByRole('heading', { name: 'Seu plano' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Fatura em aberto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Histórico de faturas' })).not.toBeInTheDocument();

    await userEvent.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Seu plano' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(servico.planoEFaturas).toHaveBeenCalledTimes(2);
  });

  it('403 com permissao: "Você não pode ver o plano desta empresa…", sem seções e sem alerta de erro', async () => {
    servico.planoEFaturas.mockRejectedValue({
      response: { status: 403, data: { error: 'forbidden', permissao: 'portal.empresa.ver' } },
    });
    render(<PlanoPage />);
    expect(
      await screen.findByText('Você não pode ver o plano desta empresa. Fale com um administrador do Portal.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Seu plano' })).not.toBeInTheDocument();
  });

  it('troca de empresa: não mostra a empresa anterior e descarta a resposta atrasada dela', async () => {
    const daPadaria = adiada<PlanoEFaturas>();
    const daLoja = adiada<PlanoEFaturas>();
    servico.planoEFaturas.mockImplementation((id: string) =>
      id === ID_DA_PADARIA ? daPadaria.promessa : daLoja.promessa,
    );
    const { rerender } = render(<PlanoPage />);

    tenant.activeTenantId = 'loja-da-ana';
    tenant.activeTenantName = 'Loja da Ana';
    rerender(<PlanoPage />);
    expect(servico.planoEFaturas).toHaveBeenLastCalledWith('loja-da-ana');

    const planoDaLoja: PlanoEFaturas = {
      ...planoEFaturasDaPadaria,
      plano: { ...planoEFaturasDaPadaria.plano, slug: 'captacao', nome: 'Captação', valor: 69.9 },
    };
    await act(async () => {
      daLoja.resolver(planoDaLoja);
    });
    expect(await screen.findByText('Captação')).toBeInTheDocument();

    // A resposta da Padaria chega depois e não pode substituir a da Loja.
    await act(async () => {
      daPadaria.resolver(planoEFaturasDaPadaria);
    });
    expect(screen.getByText('Captação')).toBeInTheDocument();
    expect(screen.queryByText('Presença')).not.toBeInTheDocument();
  });

  it('troca de empresa com a página pronta: os dados da anterior somem enquanto a nova carrega', async () => {
    const { rerender } = render(<PlanoPage />);
    expect(await screen.findByText('Presença')).toBeInTheDocument();

    servico.planoEFaturas.mockReturnValue(new Promise(() => {}));
    tenant.activeTenantId = 'loja-da-ana';
    tenant.activeTenantName = 'Loja da Ana';
    rerender(<PlanoPage />);
    expect(screen.queryByText('Presença')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('/plano: "Fatura em aberto" (T56)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    simularTela(true);
    tenant.activeTenantId = ID_DA_PADARIA;
    tenant.activeTenantName = 'Padaria Zé';
    tenant.isLoadingTenants = false;
    cobranca.resumo = resumoEmAtraso;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('pagamento da vencida confirmado: relê /me/faturas e mostra a fatura paga', async () => {
    const comVencida: PlanoEFaturas = {
      ...planoEFaturasDaPadaria,
      faturas: [{ id: 'pay_2', valor: 39.9, vencimento: '2026-11-05', situacao: 'vencida', link: 'https://www.asaas.com/i/pay2' }],
    };
    const depois: PlanoEFaturas = {
      ...planoEFaturasDaPadaria,
      faturas: [{ id: 'pay_2', valor: 39.9, vencimento: '2026-11-05', situacao: 'paga', pago_em: '2026-11-10', link: 'https://www.asaas.com/i/pay2' }],
    };
    servico.planoEFaturas.mockResolvedValueOnce(comVencida).mockResolvedValueOnce(depois);
    const { rerender } = render(<PlanoPage />);
    const pagar = await screen.findByRole('link', { name: /Pagar fatura/ });
    pagar.addEventListener('click', (e) => e.preventDefault(), { once: true });
    await act(async () => {
      fireEvent.click(pagar);
    });
    expect(screen.getByText('Aguardando a confirmação do pagamento')).toBeInTheDocument();

    cobranca.resumo = resumoEmDia;
    await act(async () => {
      rerender(<PlanoPage />);
    });
    expect(servico.planoEFaturas).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Nenhuma fatura em aberto.')).toBeInTheDocument();
  });
});

describe('/plano: histórico (T57, BP-T §15.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenant.activeTenantId = ID_DA_PADARIA;
    tenant.activeTenantName = 'Padaria Zé';
    tenant.isLoadingTenants = false;
    cobranca.resumo = resumoEmDia;
    servico.planoEFaturas.mockResolvedValue(planoEFaturasDaPadaria);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('tela larga: tabela das faturas da empresa ativa com "Nota fiscal de 05/11/2026"', async () => {
    simularTela(true);
    render(<PlanoPage />);
    expect(await screen.findByRole('table', { name: 'Faturas da Padaria Zé' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nota fiscal de 05/11/2026 (abre em nova aba)' })).toBeInTheDocument();
  });

  it('celular: lista de cartões, sem tabela', async () => {
    simularTela(false);
    render(<PlanoPage />);
    expect(await screen.findByRole('list', { name: 'Faturas da Padaria Zé' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('sem pode_gerir: nenhum link de fatura ou nota e a frase sobre quem gere', async () => {
    simularTela(true);
    servico.planoEFaturas.mockResolvedValue(planoEFaturasDaPadariaSemGerir);
    render(<PlanoPage />);
    await screen.findByRole('table', { name: 'Faturas da Padaria Zé' });
    expect(screen.queryByRole('link', { name: /Ver fatura|Nota fiscal|Pagar fatura/ })).not.toBeInTheDocument();
    expect(
      screen.getByText('Os links das faturas e das notas fiscais aparecem só para quem gere o contrato.'),
    ).toBeInTheDocument();
  });
});

describe('/plano: "Seu plano" (T55)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simularTela(true);
    tenant.activeTenantId = ID_DA_PADARIA;
    tenant.activeTenantName = 'Padaria Zé';
    tenant.isLoadingTenants = false;
    servico.planoEFaturas.mockResolvedValue(planoEFaturasDaPadaria);
  });
  afterEach(() => vi.unstubAllGlobals());

  async function secaoSeuPlano() {
    const titulo = await screen.findByRole('heading', { name: 'Seu plano' });
    return within(titulo.closest('section') as HTMLElement);
  }

  it('nome, valor por mês, próximo vencimento, forma de pagamento e cada destaque em lista', async () => {
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    expect(secao.getByText('Presença')).toBeInTheDocument();
    expect(secao.getByText('R$ 39,90 por mês')).toBeInTheDocument();
    expect(secao.getByText('Próximo vencimento: 05/12/2026')).toBeInTheDocument();
    expect(secao.getByText('Forma de pagamento: Pix')).toBeInTheDocument();
    const destaques = secao.getAllByRole('listitem').map((item) => item.textContent);
    expect(destaques).toEqual(['Domínio próprio', 'Blog', 'Até 3 páginas']);
  });

  it('anual: valor por ano; forma vazia: "Você escolhe ao pagar a fatura"', async () => {
    servico.planoEFaturas.mockResolvedValue({
      ...planoEFaturasDaPadaria,
      plano: { ...planoEFaturasDaPadaria.plano, valor: 399, ciclo: 'anual', forma_de_pagamento: '' },
    });
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    expect(secao.getByText('R$ 399,00 por ano')).toBeInTheDocument();
    expect(secao.getByText('Forma de pagamento: Você escolhe ao pagar a fatura')).toBeInTheDocument();
  });

  it('nenhum botão ou link "Mudar de plano" nem "Trocar forma de pagamento" nesta fase', async () => {
    render(<PlanoPage />);
    await secaoSeuPlano();
    expect(screen.queryByRole('button', { name: /Mudar de plano/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Mudar de plano/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Trocar forma de pagamento/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Trocar forma de pagamento/ })).not.toBeInTheDocument();
  });
});
