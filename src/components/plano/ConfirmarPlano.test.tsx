import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { TermStatusItem } from '@/services/api';
import type { PlanoDoCliente } from '@/types/cobranca';
import type { ErroDaTroca } from '@/types/planos';
import { planoEFaturasDaPadaria } from '@/test/cobrancaFixtures';
import { captacaoUpgrade, presencaAtual } from '@/test/planosFixtures';

// spec: cobranca-e-plano-do-cliente RF5-03, T83 (confirmação da troca, BP-T §11.5) e T84
// (termo do plano novo depois da troca, BP-T §11.6, D-2, DV-36).

const planos = vi.hoisted(() => ({ listar: vi.fn(), mudar: vi.fn() }));
vi.mock('@/services/planos', () => ({ PlanosService: planos }));

const termos = vi.hoisted(() => ({ getStatus: vi.fn(), accept: vi.fn() }));
vi.mock('@/services/api', async () => {
  const real = await vi.importActual<typeof import('@/services/api')>('@/services/api');
  return { ...real, TermsService: termos };
});

import ConfirmarPlano from './ConfirmarPlano';

const ID = 't1';
const pix: PlanoDoCliente = planoEFaturasDaPadaria.plano;
const cartao: PlanoDoCliente = { ...pix, forma_de_pagamento: 'CREDIT_CARD' };

const TEXTO_GENERICO = 'Não foi possível trocar o plano agora. Nada foi alterado. Tente de novo em alguns minutos.';

function abrir(plano: PlanoDoCliente = pix, aoFechar = vi.fn()) {
  render(<ConfirmarPlano tenantId={ID} atual={presencaAtual} novo={captacaoUpgrade} planoDoCliente={plano} aoFechar={aoFechar} />);
  return screen.getByRole('dialog', { name: 'Mudar para o plano Captação?' });
}

function adiada<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((res) => {
    resolver = res;
  });
  return { promessa, resolver };
}

describe('ConfirmarPlano (T83)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('diálogo com o nome do plano, foco em "Cancelar", o que muda e quanto e quando', () => {
    const dialogo = abrir();
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    expect(within(dialogo).getByRole('heading', { name: 'O que muda agora' })).toBeInTheDocument();
    const lista = within(dialogo).getByRole('list', { name: 'O que muda agora' });
    expect(within(lista).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'CRM',
      'Até 5 páginas',
      'Sem a assinatura “Feito com Unum People”',
      'Até 10 usuários',
    ]);

    expect(within(dialogo).getByRole('heading', { name: 'Quanto e quando' })).toBeInTheDocument();
    expect(
      within(dialogo).getByText('R$ 69,90 por mês a partir do vencimento de 05/12/2026. Até lá, nada muda na sua fatura.'),
    ).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Confirmar a troca' })).toBeEnabled();
  });

  it('aviso do cartão só com forma de pagamento CREDIT_CARD', () => {
    const aviso = 'Você paga no cartão. A próxima fatura chega como link, e você informa o cartão de novo para pagar.';
    const { unmount } = render(
      <ConfirmarPlano tenantId={ID} atual={presencaAtual} novo={captacaoUpgrade} planoDoCliente={pix} aoFechar={vi.fn()} />,
    );
    expect(screen.queryByText(aviso)).not.toBeInTheDocument();
    unmount();

    abrir(cartao);
    expect(screen.getByText(aviso)).toBeInTheDocument();
  });

  it('"Cancelar" fecha sem chamar a API', async () => {
    const aoFechar = vi.fn();
    const dialogo = abrir(pix, aoFechar);
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
    expect(planos.mudar).not.toHaveBeenCalled();
  });

  it('enviando: "Trocando o plano…", o diálogo não fecha e o duplo clique faz uma chamada só', async () => {
    const resposta = adiada<{ ok: true }>();
    planos.mudar.mockReturnValue(resposta.promessa);
    const aoFechar = vi.fn();
    const dialogo = abrir(pix, aoFechar);

    const confirmar = within(dialogo).getByRole('button', { name: 'Confirmar a troca' });
    await userEvent.dblClick(confirmar);
    expect(planos.mudar).toHaveBeenCalledTimes(1);
    expect(planos.mudar).toHaveBeenCalledWith(ID, 'captacao');

    expect(within(dialogo).getByRole('button', { name: 'Trocando o plano…' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Fechar' }));
    expect(aoFechar).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Mudar para o plano Captação?' })).toBeInTheDocument();

    await act(async () => {
      resposta.resolver({ ok: true });
    });
  });

  const textosDo409: [ErroDaTroca, string][] = [
    ['conta_nao_ativa', 'Pague a fatura em atraso para mudar de plano.'],
    [
      'contrato_anual',
      'Seu contrato é anual. Para mudar de plano, escreva para atendimento@unumpeople.com.br e a gente faz a troca para você.',
    ],
    [
      'dominio_ligado',
      'Este plano não tem domínio próprio, e sua conta tem um domínio ligado. Remova o domínio em Páginas para escolher este plano.',
    ],
    [
      'paginas_acima_do_limite',
      'Sua conta tem mais páginas do que este plano inclui (5). Apague páginas para escolher este plano.',
    ],
    [
      'usuarios_acima_do_limite',
      'Sua conta tem mais usuários do que este plano permite (10). Remova pessoas em Usuários para escolher este plano.',
    ],
    ['so_upgrade', 'Este plano é menor que o seu. Escreva para atendimento@unumpeople.com.br para pedir a troca.'],
    ['cancellation_requested', TEXTO_GENERICO],
  ];

  it.each(textosDo409)('409 %s: texto da §11.5 em alerta dentro do diálogo', async (codigo, texto) => {
    planos.mudar.mockResolvedValue({ ok: false, erro: codigo });
    const dialogo = abrir();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar a troca' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(texto);
    expect(within(dialogo).getByRole('button', { name: 'Confirmar a troca' })).toBeEnabled();
  });

  it('403 com permissao: MENSAGEM_SEM_PERMISSAO', async () => {
    planos.mudar.mockRejectedValue({ response: { status: 403, data: { error: 'forbidden', permissao: 'portal.contrato.cancelar' } } });
    const dialogo = abrir();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar a troca' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Você não tem permissão para fazer isso nesta empresa.');
  });

  it('outro erro: "Não foi possível trocar o plano agora…"', async () => {
    planos.mudar.mockRejectedValue({ response: { status: 500, data: { error: 'internal_error' } } });
    const dialogo = abrir();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar a troca' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(TEXTO_GENERICO);
  });
});

const termoDeContratacao: TermStatusItem = {
  type: 'contratacao_servico',
  term_id: 'termo-captacao',
  term_name: 'Contrato do plano Captação',
  required_version: 1,
  can_accept: true,
  document_url: 'https://example.com/termo-captacao.html',
};

describe('ConfirmarPlano: depois do 204 (T84)', () => {
  let locationOriginal: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    planos.mudar.mockResolvedValue({ ok: true });
    locationOriginal = window.location;
    // @ts-expect-error troca a location do jsdom por um objeto que guarda o destino.
    delete window.location;
    // @ts-expect-error idem
    window.location = { href: '' };
  });

  afterEach(() => {
    // @ts-expect-error devolve a location do jsdom.
    window.location = locationOriginal;
  });

  async function confirmar() {
    const dialogo = abrir();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar a troca' }));
  }

  it('termo de contratação pendente: grava o nome do plano e vai para /termos?return_to=/plano', async () => {
    termos.getStatus.mockResolvedValue({ pending: [termoDeContratacao], accepted: [] });
    await confirmar();
    await waitFor(() => expect(window.location.href).toBe('/termos?return_to=/plano'));
    expect(termos.getStatus).toHaveBeenCalledWith(ID);
    expect(sessionStorage.getItem('plano-novo:t1')).toBe('Captação');
    expect(sessionStorage.getItem('plano-trocado:t1')).toBe('Captação');
  });

  it('sem termo pendente: vai para /plano, só com o aviso de "Pronto!" gravado', async () => {
    termos.getStatus.mockResolvedValue({ pending: [], accepted: [] });
    await confirmar();
    await waitFor(() => expect(window.location.href).toBe('/plano'));
    expect(sessionStorage.getItem('plano-novo:t1')).toBeNull();
    expect(sessionStorage.getItem('plano-trocado:t1')).toBe('Captação');
  });

  it('pendente de outro tipo não leva a /termos', async () => {
    termos.getStatus.mockResolvedValue({ pending: [{ ...termoDeContratacao, type: 'termos_uso' }], accepted: [] });
    await confirmar();
    await waitFor(() => expect(window.location.href).toBe('/plano'));
  });

  it('erro ao ler os termos: vai para /termos?return_to=/plano (lá a pessoa vê o estado real)', async () => {
    termos.getStatus.mockRejectedValue(new Error('Network Error'));
    await confirmar();
    await waitFor(() => expect(window.location.href).toBe('/termos?return_to=/plano'));
    expect(sessionStorage.getItem('plano-trocado:t1')).toBe('Captação');
  });

  it('409: não lê os termos nem sai da tela', async () => {
    planos.mudar.mockResolvedValue({ ok: false, erro: 'so_upgrade' });
    await confirmar();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(termos.getStatus).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
    expect(sessionStorage.getItem('plano-trocado:t1')).toBeNull();
  });
});
