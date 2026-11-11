import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { CancellationPreview } from '@/services/api';
import type { PlanoEFaturas, ResumoDeCobranca } from '@/types/cobranca';
import {
  planoEFaturasDaPadaria,
  planoEFaturasDaPadariaEmAtraso,
  planoEFaturasDaPadariaEmAtrasoSemGerir,
  planoEFaturasDaPadariaForaDoAr,
  planoEFaturasDaPadariaSemAssinatura,
  planoEFaturasDaPadariaSemGerir,
  resumoBloqueado,
  resumoCancelada,
  resumoEmAtraso,
  resumoEmAtrasoSemGerir,
  resumoEmDia,
  resumoForaDoAr,
  resumoPausada,
} from '@/test/cobrancaFixtures';
import { simularTela } from '@/test/telaLarga';
import { captacaoUpgrade, planosDaPadaria, planosSoOAtual, presencaAtual } from '@/test/planosFixtures';

// spec: cobranca-e-plano-do-cliente RF3-02, T54 (estrutura e estados, BP-T §9.1 e §9.5)
// e T55 ("Seu plano", BP-T §9.2).

const servico = vi.hoisted(() => ({ planoEFaturas: vi.fn() }));
vi.mock('@/services/cobranca', () => ({ FaturasService: servico }));

// Fase 5 (T85): /plano também lê GET /me/planos, sem bloquear a página. Fora do bloco do
// T85 a leitura falha: sem a linha da sugestão; o link "Mudar de plano" depende só de
// pode_gerir (TASK-FIX-F5-02).
const planosServico = vi.hoisted(() => ({
  listar: vi.fn().mockRejectedValue({ response: { status: 500, data: { error: 'internal_error' } } }),
  mudar: vi.fn(),
}));
vi.mock('@/services/planos', () => ({ PlanosService: planosServico }));

// Fase 6 (T95): POST /me/forma-de-pagamento.
const formaServico = vi.hoisted(() => ({ trocar: vi.fn() }));
vi.mock('@/services/formaDePagamento', () => ({ FormaDePagamentoService: formaServico }));

const tenant = vi.hoisted(() => ({
  activeTenantId: '3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b',
  activeTenantName: 'Padaria Zé',
  isLoadingTenants: false,
}));
vi.mock('@/contexts/TenantContext', () => ({ useTenant: () => tenant }));
vi.mock('@/components/AppHeader', () => ({ default: () => <header>cabeçalho</header> }));

const cancelamento = vi.hoisted(() => ({ getPreview: vi.fn(), request: vi.fn() }));
vi.mock('@/services/api', async () => {
  const real = await vi.importActual<typeof import('@/services/api')>('@/services/api');
  return { ...real, CancellationService: cancelamento };
});

const cobranca = vi.hoisted(() => ({
  resumo: null as ResumoDeCobranca | null,
  carregando: false,
  erro: false,
  recarregar: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/contexts/CobrancaContext', () => ({ useCobranca: () => cobranca }));

import PlanoPage from './page';

const ID_DA_PADARIA = '3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b';

// Prévia do cancelamento que deixa o SubscriptionCancel mostrar a seção "Assinatura".
const PREVIA_QUE_CANCELA: CancellationPreview = {
  can_cancel: true,
  reason: '',
  kind: 'fim_de_periodo',
  effective_at: '2026-12-05',
  refund: null,
  refund_deadline: '',
  purge_days: 30,
  scheduled: null,
};

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
    cancelamento.getPreview.mockResolvedValue(PREVIA_QUE_CANCELA);
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
    expect(await screen.findByRole('heading', { name: 'Assinatura' })).toBeInTheDocument();
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

  it('403 com permissao: "Você não pode ver o plano desta empresa…", sem seções, sem cancelamento e sem alerta de erro', async () => {
    const proibido = {
      response: { status: 403, data: { error: 'forbidden', permissao: 'portal.empresa.ver' } },
    };
    servico.planoEFaturas.mockRejectedValue(proibido);
    // Como a API real: GET /me/cancellation exige a mesma portal.empresa.ver (DV-47).
    cancelamento.getPreview.mockRejectedValue(proibido);
    render(<PlanoPage />);
    expect(
      await screen.findByText('Você não pode ver o plano desta empresa. Fale com um administrador do Portal.'),
    ).toBeInTheDocument();
    // Deixa terminar qualquer leitura pendente antes de afirmar a ausência.
    await act(async () => {});
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Não foi possível carregar os dados da assinatura.')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Assinatura' })).not.toBeInTheDocument();
    expect(cancelamento.getPreview).not.toHaveBeenCalled();
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

describe('/plano: "Assinatura" (T59, BP-T §9.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simularTela(true);
    tenant.activeTenantId = ID_DA_PADARIA;
    tenant.activeTenantName = 'Padaria Zé';
    tenant.isLoadingTenants = false;
    cobranca.resumo = resumoEmDia;
    servico.planoEFaturas.mockResolvedValue(planoEFaturasDaPadaria);
    cancelamento.getPreview.mockResolvedValue(PREVIA_QUE_CANCELA);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('o cancelamento da assinatura fica no fim de /plano, com a empresa ativa', async () => {
    render(<PlanoPage />);
    const titulo = await screen.findByRole('heading', { name: 'Assinatura' });
    expect(cancelamento.getPreview).toHaveBeenCalledWith(ID_DA_PADARIA);
    expect(within(titulo.closest('section') as HTMLElement).getByRole('button', { name: 'Cancelar assinatura' })).toBeInTheDocument();
    // Depois do histórico, no fim da página.
    const historico = screen.getByRole('heading', { name: 'Histórico de faturas' });
    expect(historico.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // DV-47: o cancelamento tem a própria leitura e não depende de /me/faturas.
  it('500 em /me/faturas: o alerta e, abaixo dele, "Cancelar assinatura" com a empresa ativa', async () => {
    servico.planoEFaturas.mockRejectedValue({ response: { status: 500, data: { error: 'internal_error' } } });
    render(<PlanoPage />);
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar o plano e as faturas.');
    const titulo = await screen.findByRole('heading', { name: 'Assinatura' });
    expect(cancelamento.getPreview).toHaveBeenCalledWith(ID_DA_PADARIA);
    expect(within(titulo.closest('section') as HTMLElement).getByRole('button', { name: 'Cancelar assinatura' })).toBeInTheDocument();
    expect(alerta.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  // Fase 5 (T85, TASK-FIX-F5-02): para quem gere, "Mudar de plano" é um link, não um botão.
  // Fase 6 (T95, BP-T §9.2): o botão "Trocar forma de pagamento" passou a existir para quem
  // gere; presença e ausência ficam no bloco do T95. Aqui: nunca é link.
  it('"Mudar de plano" só como link para /plano/mudar; "Trocar forma de pagamento" nunca é link', async () => {
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    expect(screen.queryByRole('button', { name: /Mudar de plano/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Mudar de plano/ })).toHaveLength(1);
    expect(secao.getByRole('link', { name: 'Mudar de plano' })).toHaveAttribute('href', '/plano/mudar');
    expect(screen.queryByRole('link', { name: /Trocar forma de pagamento/ })).not.toBeInTheDocument();
  });
});

// spec: cobranca-e-plano-do-cliente RF5-03, T84 (BP-T §11.5, DV-36): depois da troca, o
// "Pronto!" aparece uma vez em /plano.
describe('/plano: aviso de plano trocado (T84)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    cancelamento.getPreview.mockResolvedValue(PREVIA_QUE_CANCELA);
    simularTela(true);
    tenant.activeTenantId = ID_DA_PADARIA;
    tenant.activeTenantName = 'Padaria Zé';
    tenant.isLoadingTenants = false;
    servico.planoEFaturas.mockResolvedValue(planoEFaturasDaPadaria);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('com a chave da empresa: "Pronto! Sua conta está no plano Captação." em status, uma vez só', async () => {
    sessionStorage.setItem(`plano-trocado:${ID_DA_PADARIA}`, 'Captação');
    const { unmount } = render(<PlanoPage />);
    expect(await screen.findByRole('status')).toHaveTextContent('Pronto! Sua conta está no plano Captação.');
    expect(sessionStorage.getItem(`plano-trocado:${ID_DA_PADARIA}`)).toBeNull();
    unmount();

    render(<PlanoPage />);
    await screen.findByRole('heading', { name: 'Seu plano' });
    expect(screen.queryByText(/Pronto! Sua conta está no plano/)).not.toBeInTheDocument();
  });

  it('sem a chave: nenhum aviso', async () => {
    sessionStorage.setItem('plano-trocado:outra-empresa', 'Captação');
    render(<PlanoPage />);
    await screen.findByRole('heading', { name: 'Seu plano' });
    expect(screen.queryByText(/Pronto! Sua conta está no plano/)).not.toBeInTheDocument();
  });
});

// spec: cobranca-e-plano-do-cliente RF5-03, T85 (BP-T §9.2, §11.7): sugestão e "Mudar de
// plano" no bloco "Seu plano".
describe('/plano: sugestão e "Mudar de plano" (T85)', () => {
  const SUGESTAO =
    'No plano Captação você ganha CRM, até 5 páginas, sem a assinatura “Feito com Unum People” e até 10 usuários.';
  const erroDosPlanos = { response: { status: 500, data: { error: 'internal_error' } } };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    cancelamento.getPreview.mockResolvedValue(PREVIA_QUE_CANCELA);
    simularTela(true);
    tenant.activeTenantId = ID_DA_PADARIA;
    tenant.activeTenantName = 'Padaria Zé';
    tenant.isLoadingTenants = false;
    servico.planoEFaturas.mockResolvedValue(planoEFaturasDaPadaria);
    planosServico.listar.mockResolvedValue(planosDaPadaria.planos);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    planosServico.listar.mockRejectedValue(erroDosPlanos);
  });

  async function secaoSeuPlano() {
    const titulo = await screen.findByRole('heading', { name: 'Seu plano' });
    return within(titulo.closest('section') as HTMLElement);
  }

  it('quem gere, com upgrade: a linha da sugestão e o link "Mudar de plano" para /plano/mudar', async () => {
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    expect(await secao.findByText(SUGESTAO)).toBeInTheDocument();
    expect(secao.getByRole('link', { name: 'Mudar de plano' })).toHaveAttribute('href', '/plano/mudar');
    expect(planosServico.listar).toHaveBeenCalledWith(ID_DA_PADARIA);
    // Os destaques continuam sendo a única lista do bloco (T55).
    expect(secao.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Domínio próprio', 'Blog', 'Até 3 páginas']);
  });

  it('sem upgrade (só o atual): sem a linha, com o link', async () => {
    planosServico.listar.mockResolvedValue(planosSoOAtual.planos);
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    expect(await secao.findByRole('link', { name: 'Mudar de plano' })).toHaveAttribute('href', '/plano/mudar');
    expect(secao.queryByText(/^No plano /)).not.toBeInTheDocument();
  });

  it('upgrade indisponível não é sugerido', async () => {
    // TASK-FIX-F5-03: dominio_ligado só existe para plano destino sem domínio próprio.
    planosServico.listar.mockResolvedValue([
      presencaAtual,
      { ...captacaoUpgrade, sem_dominio_proprio: true, indisponivel_por: 'dominio_ligado' },
    ]);
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    expect(await secao.findByRole('link', { name: 'Mudar de plano' })).toBeInTheDocument();
    expect(secao.queryByText(/^No plano /)).not.toBeInTheDocument();
  });

  it('sem pode_gerir: sem o link e sem a linha', async () => {
    servico.planoEFaturas.mockResolvedValue(planoEFaturasDaPadariaSemGerir);
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    await act(async () => {});
    expect(secao.queryByRole('link', { name: 'Mudar de plano' })).not.toBeInTheDocument();
    expect(secao.queryByText(/^No plano /)).not.toBeInTheDocument();
  });

  it('GET /me/planos com erro: sem a linha, e o resto da página igual (com o link)', async () => {
    planosServico.listar.mockRejectedValue(erroDosPlanos);
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    await act(async () => {});
    expect(secao.queryByText(/^No plano /)).not.toBeInTheDocument();
    // TASK-FIX-F5-02 (BP-T §9.2): o link depende só de quem gere; /plano/mudar tem o próprio erro.
    expect(secao.getByRole('link', { name: 'Mudar de plano' })).toHaveAttribute('href', '/plano/mudar');
    expect(secao.getByText('Presença')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fatura em aberto' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Histórico de faturas' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a leitura dos planos não segura a página', async () => {
    planosServico.listar.mockReturnValue(new Promise(() => {}));
    render(<PlanoPage />);
    expect(await screen.findByRole('heading', { name: 'Seu plano' })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy', 'true');
  });

  it('com GET /me/planos ainda carregando: o link "Mudar de plano" já aparece, sem a linha (TASK-FIX-F5-02)', async () => {
    planosServico.listar.mockReturnValue(new Promise(() => {}));
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    expect(secao.getByRole('link', { name: 'Mudar de plano' })).toHaveAttribute('href', '/plano/mudar');
    expect(secao.queryByText(/^No plano /)).not.toBeInTheDocument();
  });

  it('sem pode_gerir e GET /me/planos com erro: sem o link (TASK-FIX-F5-02)', async () => {
    servico.planoEFaturas.mockResolvedValue(planoEFaturasDaPadariaSemGerir);
    planosServico.listar.mockRejectedValue(erroDosPlanos);
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    await act(async () => {});
    expect(secao.queryByRole('link', { name: 'Mudar de plano' })).not.toBeInTheDocument();
  });
});

// spec: cobranca-e-plano-do-cliente RF6-02, RF6-03, T95 (BP-T §12.1, §12.2, §12.3): botão
// "Trocar forma de pagamento" no bloco "Seu plano" e a D-4 com o resultado gravado (B).
describe('/plano: "Trocar forma de pagamento" (T95)', () => {
  const EM_ATRASO = 'Pague a fatura em atraso antes de trocar a forma de pagamento.';
  const CONTA_EM_DIA = 'A forma de pagamento só pode ser trocada com a conta em dia.';
  const comBoleto: PlanoEFaturas = {
    ...planoEFaturasDaPadaria,
    plano: { ...planoEFaturasDaPadaria.plano, forma_de_pagamento: 'BOLETO' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    cancelamento.getPreview.mockResolvedValue(PREVIA_QUE_CANCELA);
    simularTela(true);
    tenant.activeTenantId = ID_DA_PADARIA;
    tenant.activeTenantName = 'Padaria Zé';
    tenant.isLoadingTenants = false;
    servico.planoEFaturas.mockResolvedValue(planoEFaturasDaPadaria);
    cobranca.resumo = resumoEmDia;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cobranca.resumo = null;
    cobranca.carregando = false;
    cobranca.erro = false;
  });

  async function secaoSeuPlano() {
    const titulo = await screen.findByRole('heading', { name: 'Seu plano' });
    return within(titulo.closest('section') as HTMLElement);
  }

  it('quem gere: botão "Trocar forma de pagamento" ativo no bloco "Seu plano"', async () => {
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    expect(secao.getByRole('button', { name: 'Trocar forma de pagamento' })).toBeEnabled();
  });

  it('sem pode_gerir: nenhum botão "Trocar forma de pagamento"', async () => {
    servico.planoEFaturas.mockResolvedValue(planoEFaturasDaPadariaSemGerir);
    render(<PlanoPage />);
    await secaoSeuPlano();
    expect(screen.queryByRole('button', { name: /Trocar forma de pagamento/ })).not.toBeInTheDocument();
  });

  // TASK-FIX-F6-P03 (L-F2): o motivo da troca bloqueada é só de quem gere; para os outros, nem
  // botão nem motivo, também nos estados em que o botão de quem gere fica desabilitado.
  it.each([
    ['em atraso', { resumo: resumoEmAtrasoSemGerir, carregando: false }, planoEFaturasDaPadariaEmAtrasoSemGerir],
    ['com o resumo carregando', { resumo: null, carregando: true }, planoEFaturasDaPadariaSemGerir],
  ])('sem pode_gerir %s: nenhum botão e nenhum motivo da troca', async (_caso, estadoDoResumo, faturas) => {
    cobranca.resumo = estadoDoResumo.resumo;
    cobranca.carregando = estadoDoResumo.carregando;
    servico.planoEFaturas.mockResolvedValue(faturas);
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    await act(async () => {});
    expect(secao.queryByRole('button', { name: /Trocar forma de pagamento/ })).not.toBeInTheDocument();
    expect(screen.queryByText(EM_ATRASO)).not.toBeInTheDocument();
    expect(screen.queryByText(CONTA_EM_DIA)).not.toBeInTheDocument();
  });

  it('o botão abre a caixa com a forma atual do contrato e a fatura a vencer', async () => {
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    await userEvent.click(secao.getByRole('button', { name: 'Trocar forma de pagamento' }));
    const dialogo = screen.getByRole('dialog', { name: 'Trocar forma de pagamento' });
    expect(within(dialogo).getByRole('radio', { name: 'Pix (atual)' })).toBeChecked();
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
    expect(
      within(dialogo).getByText('A fatura de R$ 39,90 que vence em 05/12, já gerada, também passa para boleto.'),
    ).toBeInTheDocument();
  });

  it('sucesso: relê /me/faturas, "Forma de pagamento trocada para Boleto." em status e o foco volta ao botão', async () => {
    formaServico.trocar.mockResolvedValue(undefined);
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    const botao = secao.getByRole('button', { name: 'Trocar forma de pagamento' });
    await userEvent.click(botao);
    const dialogo = screen.getByRole('dialog', { name: 'Trocar forma de pagamento' });
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
    servico.planoEFaturas.mockResolvedValue(comBoleto);
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Trocar para Boleto' }));

    expect(formaServico.trocar).toHaveBeenCalledWith(ID_DA_PADARIA, 'BOLETO');
    expect(await screen.findByText('Forma de pagamento trocada para Boleto.')).toBeInTheDocument();
    expect(screen.getByText('Forma de pagamento trocada para Boleto.').closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(servico.planoEFaturas).toHaveBeenCalledTimes(2);
    expect(await secao.findByText('Forma de pagamento: Boleto')).toBeInTheDocument();
    expect(secao.getByRole('button', { name: 'Trocar forma de pagamento' })).toHaveFocus();
  });

  it('erro na troca: nada muda na página, o erro fica no diálogo', async () => {
    formaServico.trocar.mockRejectedValue({ response: { status: 500, data: { error: 'internal_error' } } });
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    await userEvent.click(secao.getByRole('button', { name: 'Trocar forma de pagamento' }));
    const dialogo = screen.getByRole('dialog', { name: 'Trocar forma de pagamento' });
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Trocar para Boleto' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'Não foi possível trocar agora. Nada foi alterado. Tente de novo em alguns minutos.',
    );
    expect(screen.queryByText(/Forma de pagamento trocada/)).not.toBeInTheDocument();
    expect(servico.planoEFaturas).toHaveBeenCalledTimes(1);
    expect(secao.getByText('Forma de pagamento: Pix')).toBeInTheDocument();
  });

  // L-F4: /me/faturas de cada caso coerente com o resumo (a de 05/11 vencida, nunca paga).
  it.each([
    ['em_atraso', resumoEmAtraso, planoEFaturasDaPadariaEmAtraso],
    ['bloqueado', resumoBloqueado, planoEFaturasDaPadariaEmAtraso],
    ['fora_do_ar', resumoForaDoAr, planoEFaturasDaPadariaForaDoAr],
  ])('resultado B com %s: botão desabilitado com o motivo como descrição acessível', async (_s, resumo, faturas) => {
    cobranca.resumo = resumo;
    servico.planoEFaturas.mockResolvedValue(faturas);
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    const botao = secao.getByRole('button', { name: 'Trocar forma de pagamento' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAccessibleDescription(EM_ATRASO);
    expect(secao.getByText(EM_ATRASO)).toBeInTheDocument();
    // TASK-FIX-F6-P02 (L-F1): com a troca de forma bloqueada, "Mudar de plano" continua ao lado.
    expect(secao.getByRole('link', { name: 'Mudar de plano' })).toHaveAttribute('href', '/plano/mudar');
  });

  it('em dia: sem o motivo do atraso', async () => {
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    expect(secao.queryByText(EM_ATRASO)).not.toBeInTheDocument();
    expect(secao.queryByText(CONTA_EM_DIA)).not.toBeInTheDocument();
  });

  // TASK-FIX-F6-P01 (RF6-03, Verifier F6 L3): fora de em_dia e do atraso, a API recusa a troca
  // (409 conta_nao_ativa); o botão não fica ativo para receber "Tente de novo".
  // L-F4: pausada e cancelada não têm assinatura, então não há fatura a vencer.
  it.each([
    ['pausada', resumoPausada, planoEFaturasDaPadariaSemAssinatura],
    ['cancelada', resumoCancelada, planoEFaturasDaPadariaSemAssinatura],
    ['outra', { ...resumoEmDia, situacao: 'outra' } as ResumoDeCobranca, planoEFaturasDaPadaria],
  ])('%s: botão desabilitado com "só com a conta em dia" como descrição acessível', async (_s, resumo, faturas) => {
    cobranca.resumo = resumo;
    servico.planoEFaturas.mockResolvedValue(faturas);
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    const botao = secao.getByRole('button', { name: 'Trocar forma de pagamento' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAccessibleDescription(CONTA_EM_DIA);
    expect(secao.getByText(CONTA_EM_DIA)).toBeInTheDocument();
    expect(secao.queryByText(EM_ATRASO)).not.toBeInTheDocument();
    // TASK-FIX-F6-P02 (L-F1): com a troca de forma bloqueada, "Mudar de plano" continua ao lado.
    expect(secao.getByRole('link', { name: 'Mudar de plano' })).toHaveAttribute('href', '/plano/mudar');
  });

  it.each([
    ['resumo de /me/cobranca ainda não chegou', { carregando: true, erro: false }],
    ['resumo de /me/cobranca falhou', { carregando: false, erro: true }],
  ])('%s: botão desabilitado com "só com a conta em dia"', async (_caso, estadoDoResumo) => {
    cobranca.resumo = null;
    cobranca.carregando = estadoDoResumo.carregando;
    cobranca.erro = estadoDoResumo.erro;
    render(<PlanoPage />);
    const secao = await secaoSeuPlano();
    const botao = secao.getByRole('button', { name: 'Trocar forma de pagamento' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAccessibleDescription(CONTA_EM_DIA);
    expect(secao.getByText(CONTA_EM_DIA)).toBeInTheDocument();
    // TASK-FIX-F6-P02 (L-F1): com a troca de forma bloqueada, "Mudar de plano" continua ao lado.
    expect(secao.getByRole('link', { name: 'Mudar de plano' })).toHaveAttribute('href', '/plano/mudar');
  });
});
