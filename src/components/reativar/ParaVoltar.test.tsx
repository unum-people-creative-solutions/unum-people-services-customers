import { useCallback, useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PlanoEFaturas, ResumoDeCobranca } from '@/types/cobranca';
import {
  planoEFaturasDaPadaria,
  respostaDaReativacao,
  resumoEmDia,
  resumoForaDoAr,
  resumoForaDoArComReativacaoPendente,
} from '@/test/cobrancaFixtures';

// spec: cobranca-e-plano-do-cliente RF4-06, T74 (/reativar: gerar, pagar, esperar e
// confirmar; BP-T §10.2 e a espera da §5).

const reativacao = vi.hoisted(() => ({ pedir: vi.fn() }));
vi.mock('@/services/cobranca', () => ({ ReativacaoService: reativacao }));

const ID_DA_PADARIA = '3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b';
vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => ({ activeTenantId: '3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b', activeTenantName: 'Padaria Zé' }),
}));

// Resumo compartilhado como o do CobrancaProvider: `recarregar` relê e troca o resumo.
const leitura = vi.hoisted(() => ({
  proximo: null as ResumoDeCobranca | null,
  recarregar: vi.fn(),
  contexto: null as unknown,
}));
vi.mock('@/contexts/CobrancaContext', () => ({ useCobranca: () => leitura.contexto }));

import ParaVoltar from './ParaVoltar';

// Faz o papel do CobrancaProvider: o resumo novo re-renderiza a tela.
function ComResumo({ inicial, dados }: { inicial: ResumoDeCobranca; dados: PlanoEFaturas }) {
  const [resumo, setResumo] = useState(inicial);
  const recarregar = useCallback(async () => {
    leitura.recarregar();
    if (leitura.proximo) setResumo(leitura.proximo);
  }, []);
  leitura.contexto = { resumo, carregando: false, erro: false, recarregar };
  return <ParaVoltar planoEFaturas={dados} />;
}

async function montar(resumo: ResumoDeCobranca, dados: PlanoEFaturas = planoEFaturasDaPadaria) {
  const r = render(<ComResumo inicial={resumo} dados={dados} />);
  await act(async () => {});
  return r;
}

function cartao() {
  return within(screen.getByRole('region', { name: 'Para voltar' }));
}

function adiada<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

const GERAR = 'Gerar a fatura de reativação';
const NAO_PODE = 'Esta conta não pode ser reativada por aqui. Escreva para atendimento@unumpeople.com.br.';
const CANCELAMENTO_PEDIDO =
  'Há um pedido de cancelamento nesta conta. Escreva para atendimento@unumpeople.com.br para reativar.';
const OUTRO_ERRO = 'Não foi possível gerar a fatura agora. Nada foi cobrado. Tente de novo em alguns minutos.';
const SEM_PERMISSAO = 'Você não tem permissão para fazer isso nesta empresa.';

describe('/reativar: gerar a fatura de reativação (T74)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    leitura.proximo = null;
  });

  it('sem cobrança gerada: botão "Gerar a fatura de reativação" e nenhum link de pagar', async () => {
    await montar(resumoForaDoAr);
    expect(cartao().getByRole('button', { name: GERAR })).toBeEnabled();
    expect(screen.queryByRole('link', { name: /Pagar fatura/ })).not.toBeInTheDocument();
  });

  it('enviando: uma chamada só (duplo clique), botão desabilitado "Gerando a fatura…" e aria-busy', async () => {
    const pedido = adiada<typeof respostaDaReativacao>();
    reativacao.pedir.mockReturnValue(pedido.promessa);
    await montar(resumoForaDoAr);

    const botao = cartao().getByRole('button', { name: GERAR });
    await act(async () => {
      fireEvent.click(botao);
      fireEvent.click(botao);
    });

    expect(reativacao.pedir).toHaveBeenCalledTimes(1);
    expect(reativacao.pedir).toHaveBeenCalledWith(ID_DA_PADARIA);
    const gerando = cartao().getByRole('button', { name: 'Gerando a fatura…' });
    expect(gerando).toBeDisabled();
    expect(screen.getByRole('region', { name: 'Para voltar' })).toHaveAttribute('aria-busy', 'true');
    await act(async () => {
      fireEvent.click(gerando);
    });
    expect(reativacao.pedir).toHaveBeenCalledTimes(1);

    await act(async () => {
      pedido.resolver(respostaDaReativacao);
    });
    expect(screen.getByRole('region', { name: 'Para voltar' })).not.toHaveAttribute('aria-busy', 'true');
  });

  it('resposta: "Fatura de reativação de R$ 39,90, vence em 08/12." e "Pagar fatura" em nova aba, sem abrir a aba sozinho', async () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    reativacao.pedir.mockResolvedValue(respostaDaReativacao);
    await montar(resumoForaDoAr);

    await act(async () => {
      fireEvent.click(cartao().getByRole('button', { name: GERAR }));
    });

    expect(cartao().getByText('Fatura de reativação de R$ 39,90, vence em 08/12.')).toBeInTheDocument();
    const pagar = cartao().getByRole('link', { name: /Pagar fatura/ });
    expect(pagar).toHaveAttribute('href', 'https://www.asaas.com/i/reativ1');
    expect(pagar).toHaveAttribute('target', '_blank');
    expect(pagar).toHaveAttribute('rel', 'noopener noreferrer');
    expect(pagar).toHaveAccessibleName(/abre em nova aba/);
    expect(cartao().queryByRole('button', { name: GERAR })).not.toBeInTheDocument();
    expect(abrir).not.toHaveBeenCalled();
    abrir.mockRestore();
  });

  it('reativacao.link já preenchido: o link aparece sem o botão, com o vencimento da fatura de /me/faturas', async () => {
    const comAFatura: PlanoEFaturas = {
      ...planoEFaturasDaPadaria,
      faturas: [
        { id: 'pay_r1', valor: 39.9, vencimento: '2026-12-08', situacao: 'a_vencer', link: 'https://www.asaas.com/i/reativ1' },
        ...planoEFaturasDaPadaria.faturas,
      ],
    };
    await montar(resumoForaDoArComReativacaoPendente, comAFatura);

    expect(cartao().getByText('Fatura de reativação de R$ 39,90, vence em 08/12.')).toBeInTheDocument();
    expect(cartao().getByRole('link', { name: /Pagar fatura/ })).toHaveAttribute('href', 'https://www.asaas.com/i/reativ1');
    expect(screen.queryByRole('button', { name: GERAR })).not.toBeInTheDocument();
    expect(reativacao.pedir).not.toHaveBeenCalled();
  });

  it('reativacao.link já preenchido sem a fatura na lista: o valor sem data e o link', async () => {
    await montar(resumoForaDoArComReativacaoPendente);
    expect(cartao().getByText('Fatura de reativação de R$ 39,90.')).toBeInTheDocument();
    expect(cartao().getByRole('link', { name: /Pagar fatura/ })).toHaveAttribute('href', 'https://www.asaas.com/i/reativ1');
    expect(screen.queryByRole('button', { name: GERAR })).not.toBeInTheDocument();
  });

  it('409 nao_pausada: alerta com o texto de "não pode ser reativada por aqui"', async () => {
    reativacao.pedir.mockResolvedValue({ tipo: 'nao_pausada' });
    await montar(resumoForaDoAr);
    await act(async () => {
      fireEvent.click(cartao().getByRole('button', { name: GERAR }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(NAO_PODE);
    expect(screen.queryByRole('link', { name: /Pagar fatura/ })).not.toBeInTheDocument();
  });

  it('409 de cancelamento pedido: alerta "Há um pedido de cancelamento nesta conta…"', async () => {
    reativacao.pedir.mockResolvedValue({ tipo: 'cancelamento_pedido' });
    await montar(resumoForaDoAr);
    await act(async () => {
      fireEvent.click(cartao().getByRole('button', { name: GERAR }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(CANCELAMENTO_PEDIDO);
  });

  it('403 com permissao: alerta com a mensagem de sem permissão', async () => {
    reativacao.pedir.mockRejectedValue({
      response: { status: 403, data: { error: 'forbidden', permissao: 'portal.contrato.cancelar' } },
    });
    await montar(resumoForaDoAr);
    await act(async () => {
      fireEvent.click(cartao().getByRole('button', { name: GERAR }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(SEM_PERMISSAO);
  });

  it('outro erro: alerta "Não foi possível gerar a fatura agora…" e o botão volta para tentar de novo', async () => {
    reativacao.pedir
      .mockRejectedValueOnce({ response: { status: 502, data: { error: 'asaas_unavailable' } } })
      .mockResolvedValueOnce(respostaDaReativacao);
    await montar(resumoForaDoAr);
    await act(async () => {
      fireEvent.click(cartao().getByRole('button', { name: GERAR }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(OUTRO_ERRO);

    await act(async () => {
      fireEvent.click(cartao().getByRole('button', { name: GERAR }));
    });
    expect(reativacao.pedir).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(cartao().getByRole('link', { name: /Pagar fatura/ })).toBeInTheDocument();
  });
});

describe('/reativar: espera e confirmação (T74, relógio falso)', () => {
  const INICIO = new Date('2026-12-05T15:00:00Z').getTime();
  const CHAVE = `cobranca-aguardando:${ID_DA_PADARIA}`;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(INICIO);
    sessionStorage.clear();
    leitura.proximo = null;
    reativacao.pedir.mockResolvedValue(respostaDaReativacao);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function passar(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  async function gerarEPagar() {
    await act(async () => {
      fireEvent.click(cartao().getByRole('button', { name: GERAR }));
    });
    const pagar = cartao().getByRole('link', { name: /Pagar fatura/ });
    // O link abre o Asaas em outra aba; aqui só interessa o que a tela faz.
    pagar.addEventListener('click', (e) => e.preventDefault(), { once: true });
    await act(async () => {
      fireEvent.click(pagar);
    });
  }

  it('depois de "Pagar fatura": "Aguardando a confirmação do pagamento", consulta aos 15 s e "Pagar fatura" ainda visível', async () => {
    await montar(resumoForaDoAr);
    await gerarEPagar();

    const status = cartao().getByRole('status');
    expect(status).toHaveTextContent('Aguardando a confirmação do pagamento');
    expect(status).toHaveTextContent('Pix e cartão costumam confirmar em poucos minutos. Esta tela atualiza sozinha.');
    expect(cartao().getByRole('link', { name: /Pagar fatura/ })).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(CHAVE)!)).toEqual({ clicado_em: INICIO, vencimento: '2026-12-08' });

    expect(leitura.recarregar).not.toHaveBeenCalled();
    await passar(15_000);
    expect(leitura.recarregar).toHaveBeenCalledTimes(1);
  });

  it('resumo em_dia: "Conta reativada. Sua página está no ar de novo.", "Abrir Páginas" e a lembrança do domínio', async () => {
    await montar(resumoForaDoAr);
    await gerarEPagar();

    leitura.proximo = resumoEmDia;
    await passar(15_000);

    expect(screen.getByRole('status')).toHaveTextContent('Conta reativada. Sua página está no ar de novo.');
    expect(screen.getByRole('link', { name: 'Abrir Páginas' })).toHaveAttribute(
      'href',
      'https://unumpeople.app/minha-conta',
    );
    expect(screen.getByText('Se você usava um domínio próprio, ligue de novo em Páginas › Domínio próprio.')).toBeInTheDocument();
    expect(screen.queryByText('Sua conta está ativa. Não há nada para reativar.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pagar fatura/ })).not.toBeInTheDocument();
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
  });

  it('10 min sem confirmar: "Ainda não recebemos a confirmação…" com "Conferir agora" (uma consulta) e "Pagar fatura"', async () => {
    await montar(resumoForaDoAr);
    await gerarEPagar();

    await passar(10 * 60_000);
    expect(cartao().getByRole('status')).toHaveTextContent(
      'Ainda não recebemos a confirmação. Pix e cartão confirmam em poucos minutos. Boleto leva até 3 dias úteis. O acesso volta sozinho quando o pagamento for confirmado.',
    );
    const consultas = leitura.recarregar.mock.calls.length;
    await act(async () => {
      fireEvent.click(cartao().getByRole('button', { name: 'Conferir agora' }));
    });
    expect(leitura.recarregar).toHaveBeenCalledTimes(consultas + 1);
    expect(cartao().getByRole('link', { name: /Pagar fatura/ })).toBeInTheDocument();
  });
});
