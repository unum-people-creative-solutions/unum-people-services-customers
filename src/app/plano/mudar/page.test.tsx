import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PlanoEFaturas, ResumoDeCobranca } from '@/types/cobranca';
import type { PlanoParaTroca } from '@/types/planos';
import {
  planoEFaturasDaPadaria,
  resumoBloqueado,
  resumoCancelada,
  resumoEmAtraso,
  resumoEmDia,
  resumoForaDoAr,
  resumoPausada,
} from '@/test/cobrancaFixtures';
import { basicoDowngrade, captacaoUpgrade, planosDaPadaria, planosSoOAtual, presencaAtual } from '@/test/planosFixtures';
import { simularTela } from '@/test/telaLarga';

// spec: cobranca-e-plano-do-cliente RF5-03, T82 (/plano/mudar, BP-T §11.1–§11.4 e a linha
// "/plano/mudar" de §15.1).

const planos = vi.hoisted(() => ({ listar: vi.fn(), mudar: vi.fn() }));
vi.mock('@/services/planos', () => ({ PlanosService: planos }));

const faturas = vi.hoisted(() => ({ planoEFaturas: vi.fn() }));
vi.mock('@/services/cobranca', () => ({ FaturasService: faturas }));

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

import MudarDePlanoPage from './page';

const ID_DA_PADARIA = '3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b';
const EMAIL = 'mailto:atendimento@unumpeople.com.br';
const TEXTO_DO_MENOR = 'Quer um plano menor? Escreva para atendimento@unumpeople.com.br e a gente faz a troca para você.';
const CONTA_EM_DIA = 'A troca de plano só pode ser feita com a conta em dia.';
const TEXTO_DO_ANUAL =
  'Seu contrato é anual. Para mudar de plano, escreva para atendimento@unumpeople.com.br e a gente faz a troca para você.';

// Parágrafo inteiro, mesmo com o e-mail num link no meio.
const paragrafo = (texto: string) => (_: string, el: Element | null) => el?.tagName === 'P' && el.textContent === texto;

const anual: PlanoEFaturas = {
  ...planoEFaturasDaPadaria,
  plano: { ...planoEFaturasDaPadaria.plano, valor: 399, ciclo: 'anual' },
};

async function abrir() {
  render(<MudarDePlanoPage />);
  return screen.findByRole('region', { name: 'Presença' });
}

describe('/plano/mudar (T82)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simularTela(true);
    tenant.activeTenantId = ID_DA_PADARIA;
    tenant.isLoadingTenants = false;
    cobranca.resumo = resumoEmDia;
    cobranca.carregando = false;
    cobranca.erro = false;
    planos.listar.mockResolvedValue(planosDaPadaria.planos);
    faturas.planoEFaturas.mockResolvedValue(planoEFaturasDaPadaria);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('normal: o atual com "Seu plano", o upgrade com as linhas e "Escolher o Captação"', async () => {
    const atual = await abrir();
    expect(screen.getByRole('heading', { level: 1, name: 'Mudar de plano' })).toBeInTheDocument();
    expect(screen.getByText('O plano novo vale na hora. O preço novo entra no próximo vencimento.')).toBeInTheDocument();
    expect(planos.listar).toHaveBeenCalledWith(ID_DA_PADARIA);
    expect(faturas.planoEFaturas).toHaveBeenCalledWith(ID_DA_PADARIA);

    expect(within(atual).getByText('Seu plano')).toBeInTheDocument();
    expect(within(atual).getByText('R$ 39,90 por mês')).toBeInTheDocument();
    expect(within(atual).getByText('Páginas: 3')).toBeInTheDocument();
    expect(within(atual).getByText('CRM: Não')).toBeInTheDocument();
    expect(within(atual).getByText('Usuários: 3')).toBeInTheDocument();
    expect(within(atual).queryByRole('button')).not.toBeInTheDocument();

    const captacao = screen.getByRole('region', { name: 'Captação' });
    expect(within(captacao).queryByText('Seu plano')).not.toBeInTheDocument();
    expect(within(captacao).getByText('R$ 69,90 por mês')).toBeInTheDocument();
    expect(within(captacao).getByText('Páginas: 5')).toBeInTheDocument();
    expect(within(captacao).getByText('(+2)')).toBeInTheDocument();
    expect(within(captacao).getByText('Domínio próprio: Sim')).toBeInTheDocument();
    expect(within(captacao).getByText('Sem a assinatura “Feito com Unum People”: Sim')).toBeInTheDocument();
    expect(within(captacao).getByText('Blog: Sim')).toBeInTheDocument();
    expect(within(captacao).getByText('CRM: Sim')).toBeInTheDocument();
    expect(within(captacao).getAllByText('Novo')).toHaveLength(2);
    expect(within(captacao).getByText('Usuários: 10')).toBeInTheDocument();
    expect(within(captacao).getByText('(+7)')).toBeInTheDocument();
    expect(within(captacao).getByRole('button', { name: 'Escolher o Captação' })).toBeEnabled();

    expect(screen.getByText(paragrafo(TEXTO_DO_MENOR))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'atendimento@unumpeople.com.br' })).toHaveAttribute('href', EMAIL);
  });

  it('"Escolher o Captação" abre a confirmação; "Cancelar" fecha sem trocar (T83)', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Escolher o Captação' }));
    const dialogo = screen.getByRole('dialog', { name: 'Mudar para o plano Captação?' });
    expect(
      within(dialogo).getByText('R$ 69,90 por mês a partir do vencimento de 05/12/2026. Até lá, nada muda na sua fatura.'),
    ).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(planos.mudar).not.toHaveBeenCalled();
  });

  it('nenhum cartão nem botão de downgrade, mesmo que a API mande um', async () => {
    planos.listar.mockResolvedValue([basicoDowngrade, presencaAtual, captacaoUpgrade]);
    await abrir();
    expect(screen.queryByRole('region', { name: 'Básico' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Básico/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Escolher/ })).toHaveLength(1);
  });

  it('indisponível: botão desabilitado com o motivo como descrição acessível', async () => {
    const indisponivel: PlanoParaTroca = { ...captacaoUpgrade, indisponivel_por: 'paginas_acima_do_limite' };
    planos.listar.mockResolvedValue([presencaAtual, indisponivel]);
    await abrir();
    const botao = screen.getByRole('button', { name: 'Escolher o Captação' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAccessibleDescription(
      'Sua conta tem mais páginas do que este plano inclui (5). Apague páginas para escolher este plano.',
    );
  });

  it('indisponível por usuários: motivo com o link para Usuários', async () => {
    planos.listar.mockResolvedValue([presencaAtual, { ...captacaoUpgrade, indisponivel_por: 'usuarios_acima_do_limite' }]);
    await abrir();
    expect(screen.getByRole('button', { name: 'Escolher o Captação' })).toHaveAccessibleDescription(
      'Sua conta tem mais usuários do que este plano permite (10). Remova pessoas em Usuários para escolher este plano.',
    );
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/usuarios');
  });

  it('contrato anual: só o atual e o texto do anual, sem botões', async () => {
    faturas.planoEFaturas.mockResolvedValue(anual);
    // A API manda o valor do contrato no atual (DV-33); mesmo que mande um upgrade, ele não aparece.
    planos.listar.mockResolvedValue([{ ...presencaAtual, valor: 399 }, captacaoUpgrade]);
    const atual = await abrir();
    expect(within(atual).getByText('R$ 399,00 por ano')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Captação' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Escolher/ })).not.toBeInTheDocument();
    expect(screen.getByText(paragrafo(TEXTO_DO_ANUAL))).toBeInTheDocument();
  });

  it('fatura em atraso: aviso no topo e botões desabilitados com o motivo', async () => {
    cobranca.resumo = resumoEmAtraso;
    await abrir();
    expect(screen.getByText('Pague a fatura em atraso para mudar de plano.')).toBeInTheDocument();
    const pagar = screen.getByRole('link', { name: /Pagar fatura/ });
    expect(pagar).toHaveAttribute('href', 'https://www.asaas.com/i/abc');
    expect(pagar).toHaveAttribute('target', '_blank');
    expect(pagar).toHaveAccessibleName(expect.stringContaining('abre em nova aba'));
    const botao = screen.getByRole('button', { name: 'Escolher o Captação' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAccessibleDescription('Pague a fatura em atraso para escolher este plano.');
  });

  // L-F3 (validation-final, decisão do orquestrador): "Pague a fatura em atraso…" só com atraso
  // de verdade; conta pausada, cancelada ou em outra situação lê o texto de conta em dia.
  it.each([
    ['bloqueado', resumoBloqueado],
    ['fora_do_ar', resumoForaDoAr],
  ])('%s: o mesmo aviso de fatura em atraso no topo e nos botões', async (_situacao, resumo) => {
    cobranca.resumo = resumo;
    await abrir();
    expect(screen.getByText('Pague a fatura em atraso para mudar de plano.')).toBeInTheDocument();
    expect(screen.queryByText(CONTA_EM_DIA)).not.toBeInTheDocument();
    const botao = screen.getByRole('button', { name: 'Escolher o Captação' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAccessibleDescription('Pague a fatura em atraso para escolher este plano.');
  });

  it.each([
    ['pausada', resumoPausada],
    ['cancelada', resumoCancelada],
    ['outra', { ...resumoEmDia, situacao: 'outra' } as ResumoDeCobranca],
  ])('%s: aviso de conta em dia no topo e nos botões, nunca "Pague a fatura em atraso"', async (_situacao, resumo) => {
    cobranca.resumo = resumo;
    await abrir();
    // Um no topo e um no cartão do Captação, como motivo do botão.
    expect(screen.getAllByText(CONTA_EM_DIA)).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: 'Captação' })).getByText(CONTA_EM_DIA)).toBeInTheDocument();
    expect(screen.queryByText(/Pague a fatura em atraso/)).not.toBeInTheDocument();
    const botao = screen.getByRole('button', { name: 'Escolher o Captação' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAccessibleDescription(CONTA_EM_DIA);
  });

  it('409 conta_nao_ativa: o texto segue a situação do resumo da hora do erro', async () => {
    planos.mudar.mockResolvedValue({ ok: false, erro: 'conta_nao_ativa' });
    const { rerender } = render(<MudarDePlanoPage />);
    await screen.findByRole('region', { name: 'Presença' });
    await userEvent.click(screen.getByRole('button', { name: 'Escolher o Captação' }));
    let dialogo = screen.getByRole('dialog', { name: 'Mudar para o plano Captação?' });

    // Resumo ainda em dia: a API recusou, mas a tela não sabe de atraso nenhum.
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar a troca' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(CONTA_EM_DIA);
    expect(within(dialogo).getByRole('alert')).not.toHaveTextContent(/Pague a fatura em atraso/);

    // A conta entrou em atraso com a tela aberta: o resumo novo muda o texto do 409.
    cobranca.resumo = resumoEmAtraso;
    rerender(<MudarDePlanoPage />);
    dialogo = screen.getByRole('dialog', { name: 'Mudar para o plano Captação?' });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar a troca' }));
    await waitFor(() =>
      expect(within(dialogo).getByRole('alert')).toHaveTextContent('Pague a fatura em atraso para mudar de plano.'),
    );
  });

  it('sem pode_gerir: cartões sem botões, o aviso de quem gere e "Avise o responsável pela conta"', async () => {
    cobranca.resumo = { ...resumoEmDia, pode_gerir: false };
    await abrir();
    expect(screen.getByRole('region', { name: 'Captação' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Escolher/ })).not.toBeInTheDocument();
    expect(screen.getByText('Só quem gere o contrato pode mudar de plano.')).toBeInTheDocument();
    expect(screen.getByText('Avise o responsável pela conta')).toBeInTheDocument();
  });

  it('já no maior plano: "Você já está no maior plano." e a linha do plano menor', async () => {
    planos.listar.mockResolvedValue(planosSoOAtual.planos);
    await abrir();
    expect(screen.getByText('Você já está no maior plano.')).toBeInTheDocument();
    expect(screen.getByText(paragrafo(TEXTO_DO_MENOR))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Escolher/ })).not.toBeInTheDocument();
  });

  it('carregando: main com aria-busy e nenhum cartão', () => {
    planos.listar.mockReturnValue(new Promise(() => {}));
    render(<MudarDePlanoPage />);
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('region', { name: 'Presença' })).not.toBeInTheDocument();
  });

  it('erro ao ler: alerta "Não foi possível carregar os planos." e "Tentar de novo" relê', async () => {
    planos.listar.mockRejectedValueOnce({ response: { status: 500, data: { error: 'internal_error' } } });
    render(<MudarDePlanoPage />);
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar os planos.');
    expect(screen.queryByRole('region', { name: 'Presença' })).not.toBeInTheDocument();

    await userEvent.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('region', { name: 'Captação' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('erro ao ler o plano e as faturas também mostra o alerta', async () => {
    faturas.planoEFaturas.mockRejectedValueOnce(new Error('Network Error'));
    render(<MudarDePlanoPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os planos.');
  });

  it('celular: só as linhas que mudam; "Ver tudo" (aria-expanded) abre as demais', async () => {
    simularTela(false);
    await abrir();
    const captacao = screen.getByRole('region', { name: 'Captação' });
    expect(within(captacao).getByText('Páginas: 5')).toBeInTheDocument();
    expect(within(captacao).getByText('CRM: Sim')).toBeInTheDocument();
    expect(within(captacao).queryByText('Domínio próprio: Sim')).not.toBeInTheDocument();
    expect(within(captacao).queryByText('Blog: Sim')).not.toBeInTheDocument();

    const verTudo = within(captacao).getByRole('button', { name: 'Ver tudo' });
    expect(verTudo).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(verTudo);
    expect(verTudo).toHaveAttribute('aria-expanded', 'true');
    expect(within(captacao).getByText('Domínio próprio: Sim')).toBeInTheDocument();
    expect(within(captacao).getByText('Blog: Sim')).toBeInTheDocument();
  });

  // TASK-FIX-F5-05 (L5, padrão de divulgação da WAI): aria-controls só aponta para o que
  // existe; o rótulo alterna entre "Ver tudo" e "Ver menos".
  it('celular: aria-controls só com a lista aberta e no id dela; rótulo "Ver tudo"/"Ver menos"', async () => {
    simularTela(false);
    await abrir();
    const captacao = screen.getByRole('region', { name: 'Captação' });

    const botao = within(captacao).getByRole('button', { name: 'Ver tudo' });
    const fechado = botao.getAttribute('aria-controls');
    if (fechado !== null) expect(document.getElementById(fechado)).not.toBeNull();

    await userEvent.click(botao);
    expect(within(captacao).getByRole('button', { name: 'Ver menos' })).toBe(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    const aberto = botao.getAttribute('aria-controls');
    expect(aberto).not.toBeNull();
    const lista = document.getElementById(aberto as string);
    expect(lista).not.toBeNull();
    expect(within(lista as HTMLElement).getByText('Domínio próprio: Sim')).toBeInTheDocument();
    expect(within(lista as HTMLElement).getByText('Blog: Sim')).toBeInTheDocument();

    await userEvent.click(botao);
    expect(within(captacao).getByRole('button', { name: 'Ver tudo' })).toBe(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(within(captacao).queryByText('Domínio próprio: Sim')).not.toBeInTheDocument();
    const deNovo = botao.getAttribute('aria-controls');
    if (deNovo !== null) expect(document.getElementById(deNovo)).not.toBeNull();
  });
});
