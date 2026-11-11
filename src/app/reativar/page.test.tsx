import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { PlanoEFaturas, ResumoDeCobranca } from '@/types/cobranca';
import {
  planoEFaturasDaPadaria,
  planoEFaturasDaPadariaEmAtraso,
  planoEFaturasDaPadariaEmAtrasoSemGerir,
  resumoBloqueadoSemFaturaComReativacao,
  resumoBloqueadoSemFaturaComReativacaoSemGerir,
  resumoEmAtraso,
  resumoEmAtrasoSemFaturaComReativacao,
  resumoEmDia,
  resumoForaDoAr,
  resumoForaDoArSemGerir,
} from '@/test/cobrancaFixtures';

// spec: cobranca-e-plano-do-cliente RF4-06, T73 (/reativar: situação, textos e casos sem
// ação; BP-T §10.1 e §10.2).

const faturas = vi.hoisted(() => ({ planoEFaturas: vi.fn() }));
const reativacao = vi.hoisted(() => ({ pedir: vi.fn() }));
vi.mock('@/services/cobranca', () => ({ FaturasService: faturas, ReativacaoService: reativacao }));

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

import ReativarPage from './page';

const ID_DA_PADARIA = '3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b';
const SITUACAO = 'Sua página está fora do ar por falta de pagamento. A conta será cancelada em 04/01.';
const AVISO_DO_DOMINIO =
  'Se você usava um domínio próprio, ele foi desligado quando a página saiu do ar. Depois de reativar, ligue de novo em Páginas › Domínio próprio.';
const NAO_PODE = 'Esta conta não pode ser reativada por aqui. Escreva para atendimento@unumpeople.com.br.';

const anual: PlanoEFaturas = {
  ...planoEFaturasDaPadaria,
  plano: { ...planoEFaturasDaPadaria.plano, valor: 399, ciclo: 'anual' },
};

async function montar() {
  const r = render(<ReativarPage />);
  await act(async () => {});
  return r;
}

describe('/reativar: situação e textos (T73)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    tenant.activeTenantId = ID_DA_PADARIA;
    tenant.activeTenantName = 'Padaria Zé';
    tenant.isLoadingTenants = false;
    cobranca.resumo = resumoForaDoAr;
    cobranca.carregando = false;
    cobranca.erro = false;
    faturas.planoEFaturas.mockResolvedValue(planoEFaturasDaPadaria);
  });

  it('fora_do_ar, mensal: título, situação, valor, plano, "Depois de pagar" e aviso do domínio', async () => {
    await montar();

    expect(screen.getByRole('heading', { level: 1, name: 'Reativar minha conta' })).toBeInTheDocument();
    expect(screen.getByText(SITUACAO)).toBeInTheDocument();
    expect(faturas.planoEFaturas).toHaveBeenCalledWith(ID_DA_PADARIA);

    const cartao = within(screen.getByRole('region', { name: 'Para voltar' }));
    expect(cartao.getByText('R$ 39,90')).toBeInTheDocument();
    expect(cartao.getByText('Uma mensalidade do plano Presença.')).toBeInTheDocument();
    expect(cartao.getByText('A fatura antiga não é cobrada.')).toBeInTheDocument();

    const depois = within(screen.getByRole('region', { name: 'Depois de pagar' }));
    expect(depois.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Sua página volta ao ar.',
      'Páginas, CRM e blog voltam a funcionar.',
      'Um novo ciclo começa no dia do pagamento. A próxima fatura vence em um mês.',
    ]);

    expect(screen.getByRole('heading', { name: 'Domínio próprio' })).toBeInTheDocument();
    expect(screen.getByText(AVISO_DO_DOMINIO)).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy', 'true');
  });

  it('valor vem de reativacao.valor; anual: "Uma anuidade…" e a próxima fatura "em um ano"', async () => {
    cobranca.resumo = { ...resumoForaDoAr, reativacao: { valor: 399, link: null } };
    faturas.planoEFaturas.mockResolvedValue(anual);
    await montar();

    const cartao = within(screen.getByRole('region', { name: 'Para voltar' }));
    expect(cartao.getByText('R$ 399,00')).toBeInTheDocument();
    expect(cartao.getByText('Uma anuidade do plano Presença.')).toBeInTheDocument();
    expect(
      screen.getByText('Um novo ciclo começa no dia do pagamento. A próxima fatura vence em um ano.'),
    ).toBeInTheDocument();
  });

  it('cita só as ferramentas bloqueadas da conta (BP-T D-3)', async () => {
    cobranca.resumo = { ...resumoForaDoAr, ferramentas_bloqueadas: ['lp'] };
    await montar();
    expect(screen.getByText('Páginas voltam a funcionar.')).toBeInTheDocument();
  });

  it('sem pode_gerir: o texto e o valor, sem botão de gerar nem link de pagar, e "Avise o responsável pela conta"', async () => {
    cobranca.resumo = resumoForaDoArSemGerir;
    await montar();

    expect(screen.getByText(SITUACAO)).toBeInTheDocument();
    const cartao = within(screen.getByRole('region', { name: 'Para voltar' }));
    expect(cartao.getByText('R$ 39,90')).toBeInTheDocument();
    expect(cartao.getByText('Avise o responsável pela conta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar a fatura de reativação/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pagar fatura/ })).not.toBeInTheDocument();
  });

  it('em_dia: "Sua conta está ativa. Não há nada para reativar." e link "Ir para Meus Produtos"', async () => {
    cobranca.resumo = resumoEmDia;
    await montar();

    expect(screen.getByText('Sua conta está ativa. Não há nada para reativar.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para Meus Produtos' })).toHaveAttribute('href', '/produtos');
    expect(screen.queryByRole('region', { name: 'Para voltar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar a fatura de reativação/ })).not.toBeInTheDocument();
  });

  it('pausada (pausa do operador) ou outra situação: "Esta conta não pode ser reativada por aqui…" com o e-mail', async () => {
    for (const resumo of [
      { ...resumoEmDia, situacao: 'pausada' as const },
      { ...resumoEmDia, situacao: 'cancelada' as const },
      { ...resumoEmDia, situacao: 'outra' as const },
      resumoEmAtraso,
    ]) {
      cobranca.resumo = resumo;
      const { unmount } = await montar();
      const texto = screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === NAO_PODE);
      expect(within(texto).getByRole('link', { name: 'atendimento@unumpeople.com.br' })).toHaveAttribute(
        'href',
        'mailto:atendimento@unumpeople.com.br',
      );
      expect(screen.queryByRole('region', { name: 'Para voltar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Gerar a fatura de reativação/ })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('carregando: main com aria-busy="true" e nenhum conteúdo da reativação', async () => {
    cobranca.resumo = null;
    cobranca.carregando = true;
    faturas.planoEFaturas.mockReturnValue(new Promise(() => {}));
    await montar();

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'Reativar minha conta' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Para voltar' })).not.toBeInTheDocument();
  });

  it('não lê as faturas antes de a lista de empresas carregar', async () => {
    tenant.isLoadingTenants = true;
    await montar();
    expect(faturas.planoEFaturas).not.toHaveBeenCalled();
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  });

  it('erro ao ler o resumo: alerta e "Tentar de novo" relê o resumo', async () => {
    cobranca.resumo = null;
    cobranca.erro = true;
    await montar();

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível conferir a situação da conta.');
    expect(screen.queryByRole('region', { name: 'Para voltar' })).not.toBeInTheDocument();

    await userEvent.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    expect(cobranca.recarregar).toHaveBeenCalledTimes(1);
  });

  it('erro ao ler as faturas: alerta, nada da reativação, e "Tentar de novo" relê as faturas', async () => {
    faturas.planoEFaturas.mockRejectedValueOnce({ response: { status: 500, data: { error: 'internal_error' } } });
    await montar();

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível conferir a situação da conta.');
    expect(screen.queryByRole('region', { name: 'Para voltar' })).not.toBeInTheDocument();

    await userEvent.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('region', { name: 'Para voltar' })).toBeInTheDocument();
    expect(faturas.planoEFaturas).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('troca de empresa: lê as faturas da empresa nova e descarta a resposta atrasada da anterior', async () => {
    let resolverPadaria!: (v: PlanoEFaturas) => void;
    faturas.planoEFaturas.mockImplementation((id: string) =>
      id === ID_DA_PADARIA
        ? new Promise<PlanoEFaturas>((res) => {
            resolverPadaria = res;
          })
        : Promise.resolve({ ...planoEFaturasDaPadaria, plano: { ...planoEFaturasDaPadaria.plano, nome: 'Captação' } }),
    );
    const { rerender } = render(<ReativarPage />);

    tenant.activeTenantId = 'loja-da-ana';
    tenant.activeTenantName = 'Loja da Ana';
    await act(async () => {
      rerender(<ReativarPage />);
    });
    expect(faturas.planoEFaturas).toHaveBeenLastCalledWith('loja-da-ana');
    expect(screen.getByText('Uma mensalidade do plano Captação.')).toBeInTheDocument();

    await act(async () => {
      resolverPadaria(planoEFaturasDaPadaria);
    });
    expect(screen.getByText('Uma mensalidade do plano Captação.')).toBeInTheDocument();
    expect(screen.queryByText('Uma mensalidade do plano Presença.')).not.toBeInTheDocument();
  });
});

// spec: cobranca-e-plano-do-cliente spec-f7 RF7-08, T103 (fase 7: /reativar aceita em_atraso e
// bloqueado sem fatura quando o resumo traz `reativacao`; textos do T19 e do DV-53).
describe('/reativar: conta em atraso sem fatura para pagar (T103)', () => {
  const SITUACAO_SEM_FATURA =
    'Não encontramos uma fatura em aberto desta conta. Gere a fatura de R$ 39,90 para pagar e liberar o acesso.';
  const CICLO_MENSAL = 'Um novo ciclo começa no dia do pagamento. A próxima fatura vence em um mês.';

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    tenant.activeTenantId = ID_DA_PADARIA;
    tenant.activeTenantName = 'Padaria Zé';
    tenant.isLoadingTenants = false;
    cobranca.resumo = resumoEmAtrasoSemFaturaComReativacao;
    cobranca.carregando = false;
    cobranca.erro = false;
    faturas.planoEFaturas.mockResolvedValue(planoEFaturasDaPadariaEmAtraso);
  });

  it('em_atraso, gere: a linha do T19, o valor sem "A fatura antiga…", o botão, só o ciclo em "Depois de pagar" e sem o aviso do domínio', async () => {
    await montar();

    expect(screen.getByRole('heading', { level: 1, name: 'Reativar minha conta' })).toBeInTheDocument();
    expect(screen.getByText(SITUACAO_SEM_FATURA)).toBeInTheDocument();

    const cartao = within(screen.getByRole('region', { name: 'Para voltar' }));
    expect(cartao.getByText('R$ 39,90')).toBeInTheDocument();
    expect(cartao.getByText('Uma mensalidade do plano Presença.')).toBeInTheDocument();
    expect(screen.queryByText('A fatura antiga não é cobrada.')).not.toBeInTheDocument();
    expect(cartao.getByRole('button', { name: 'Gerar a fatura de reativação' })).toBeEnabled();

    const depois = within(screen.getByRole('region', { name: 'Depois de pagar' }));
    expect(depois.getAllByRole('listitem').map((item) => item.textContent)).toEqual([CICLO_MENSAL]);
    expect(screen.queryByText('Sua página volta ao ar.')).not.toBeInTheDocument();
    expect(screen.queryByText(/voltam a funcionar\./)).not.toBeInTheDocument();

    expect(screen.queryByRole('region', { name: 'Domínio próprio' })).not.toBeInTheDocument();
    expect(screen.queryByText(AVISO_DO_DOMINIO)).not.toBeInTheDocument();
    expect(screen.queryByText(/Esta conta não pode ser reativada por aqui/)).not.toBeInTheDocument();
  });

  it('bloqueado: a mesma situação; "Depois de pagar" com as ferramentas e o ciclo, sem "Sua página volta ao ar."', async () => {
    cobranca.resumo = resumoBloqueadoSemFaturaComReativacao;
    await montar();

    expect(screen.getByText(SITUACAO_SEM_FATURA)).toBeInTheDocument();
    const depois = within(screen.getByRole('region', { name: 'Depois de pagar' }));
    expect(depois.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Páginas, CRM e blog voltam a funcionar.',
      CICLO_MENSAL,
    ]);
    expect(screen.queryByText('A fatura antiga não é cobrada.')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Domínio próprio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar a fatura de reativação' })).toBeEnabled();
  });

  it('o valor vem de reativacao.valor, não de plano.valor', async () => {
    cobranca.resumo = { ...resumoEmAtrasoSemFaturaComReativacao, reativacao: { valor: 59.9, link: null } };
    await montar();

    expect(
      screen.getByText(
        'Não encontramos uma fatura em aberto desta conta. Gere a fatura de R$ 59,90 para pagar e liberar o acesso.',
      ),
    ).toBeInTheDocument();
    const cartao = within(screen.getByRole('region', { name: 'Para voltar' }));
    expect(cartao.getByText('R$ 59,90')).toBeInTheDocument();
    expect(cartao.queryByText('R$ 39,90')).not.toBeInTheDocument();
  });

  it('anual: "Uma anuidade do plano Presença." e a próxima fatura "em um ano"', async () => {
    faturas.planoEFaturas.mockResolvedValue({
      ...planoEFaturasDaPadariaEmAtraso,
      plano: { ...planoEFaturasDaPadariaEmAtraso.plano, valor: 399, ciclo: 'anual' },
    });
    await montar();

    const cartao = within(screen.getByRole('region', { name: 'Para voltar' }));
    expect(cartao.getByText('Uma anuidade do plano Presença.')).toBeInTheDocument();
    const depois = within(screen.getByRole('region', { name: 'Depois de pagar' }));
    expect(depois.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Um novo ciclo começa no dia do pagamento. A próxima fatura vence em um ano.',
    ]);
  });

  it('sem pode_gerir: a situação, o valor e "Avise o responsável pela conta", sem botão', async () => {
    cobranca.resumo = resumoBloqueadoSemFaturaComReativacaoSemGerir;
    faturas.planoEFaturas.mockResolvedValue(planoEFaturasDaPadariaEmAtrasoSemGerir);
    await montar();

    expect(screen.getByText(SITUACAO_SEM_FATURA)).toBeInTheDocument();
    const cartao = within(screen.getByRole('region', { name: 'Para voltar' }));
    expect(cartao.getByText('R$ 39,90')).toBeInTheDocument();
    expect(cartao.getByText('Avise o responsável pela conta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar a fatura de reativação/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pagar fatura/ })).not.toBeInTheDocument();
  });
});
