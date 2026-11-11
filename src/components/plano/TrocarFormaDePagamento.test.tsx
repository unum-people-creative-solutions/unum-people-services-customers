import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { FaturaDoCliente } from '@/types/cobranca';
import { planoEFaturasDaPadaria } from '@/test/cobrancaFixtures';

// spec: cobranca-e-plano-do-cliente RF6-02, RF6-03, T94 (caixa "Trocar forma de pagamento",
// BP-T §12.2; resultado da D-4 em ops-601-sandbox.md).

const servico = vi.hoisted(() => ({ trocar: vi.fn() }));
vi.mock('@/services/formaDePagamento', () => ({ FormaDePagamentoService: servico }));

import TrocarFormaDePagamento from './TrocarFormaDePagamento';

const ID = 't1';
// A fatura a vencer da Padaria Zé (R$ 39,90, 05/12/2026), no formato do §4.2.
const aVencer: FaturaDoCliente = planoEFaturasDaPadaria.faturas[0];
const vencida: FaturaDoCliente = {
  id: 'pay_0',
  valor: 39.9,
  vencimento: '2026-11-05',
  situacao: 'vencida',
  link: 'https://www.asaas.com/i/pay0',
};

const DESCRICAO_PIX = 'Confirma na hora. A fatura chega por e-mail 5 dias antes do vencimento.';
const DESCRICAO_BOLETO = 'Leva até 3 dias úteis para confirmar depois do pagamento.';
const DESCRICAO_CARTAO = 'Cobrado no cartão no vencimento.';
const AVISO_DO_CARTAO =
  'Na próxima fatura, o Asaas pede os dados do cartão na página da fatura. Você recebe o link por e-mail.';
const SAINDO_DO_CARTAO = 'Você volta a receber o lembrete 5 dias antes e no dia do vencimento.';
const MESMA_FORMA = 'Escolha uma forma diferente da atual.';
const TEXTO_GENERICO = 'Não foi possível trocar agora. Nada foi alterado. Tente de novo em alguns minutos.';

type Props = Partial<Parameters<typeof TrocarFormaDePagamento>[0]>;

function abrir(props: Props = {}) {
  const onFechar = props.onFechar ?? vi.fn();
  const onTrocou = props.onTrocou ?? vi.fn();
  render(
    <TrocarFormaDePagamento
      aberto
      tenantId={ID}
      formaAtual="PIX"
      proximoVencimento="2026-12-05"
      faturaAVencer={aVencer}
      resultadoD4="B"
      {...props}
      onFechar={onFechar}
      onTrocou={onTrocou}
    />,
  );
  const dialogo = screen.getByRole('dialog', { name: 'Trocar forma de pagamento' });
  return { dialogo, onFechar, onTrocou };
}

function adiada<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((res) => {
    resolver = res;
  });
  return { promessa, resolver };
}

describe('TrocarFormaDePagamento (T94)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fechado: nenhum diálogo', () => {
    render(
      <TrocarFormaDePagamento
        aberto={false}
        tenantId={ID}
        formaAtual="PIX"
        resultadoD4="B"
        onFechar={vi.fn()}
        onTrocou={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('grupo "Como você quer pagar?" com três opções, a atual marcada com "(atual)" e o foco em "Cancelar"', () => {
    const { dialogo } = abrir();
    const grupo = within(dialogo).getByRole('group', { name: 'Como você quer pagar?' });
    const opcoes = within(grupo).getAllByRole('radio');
    expect(opcoes).toHaveLength(3);

    const pix = within(grupo).getByRole('radio', { name: 'Pix (atual)' });
    expect(pix).toBeChecked();
    expect(within(grupo).getByRole('radio', { name: 'Boleto' })).not.toBeChecked();
    expect(within(grupo).getByRole('radio', { name: 'Cartão de crédito' })).not.toBeChecked();
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('cada opção tem a sua descrição como descrição acessível', () => {
    const { dialogo } = abrir();
    expect(within(dialogo).getByRole('radio', { name: /Pix/ })).toHaveAccessibleDescription(DESCRICAO_PIX);
    expect(within(dialogo).getByRole('radio', { name: /Boleto/ })).toHaveAccessibleDescription(DESCRICAO_BOLETO);
    expect(within(dialogo).getByRole('radio', { name: /Cartão de crédito/ })).toHaveAccessibleDescription(
      DESCRICAO_CARTAO,
    );
  });

  it('com a forma atual escolhida, o botão fica desabilitado com "Escolha uma forma diferente da atual."', () => {
    const { dialogo } = abrir({ formaAtual: 'BOLETO' });
    expect(within(dialogo).getByRole('radio', { name: 'Boleto (atual)' })).toBeChecked();
    const botao = within(dialogo).getByRole('button', { name: 'Trocar para Boleto' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAccessibleDescription(MESMA_FORMA);
    expect(within(dialogo).getByText(MESMA_FORMA)).toBeInTheDocument();
  });

  it('escolher Boleto: botão "Trocar para Boleto" ativo e a frase da fatura a vencer', async () => {
    const { dialogo } = abrir();
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
    expect(within(dialogo).getByRole('button', { name: 'Trocar para Boleto' })).toBeEnabled();
    expect(within(dialogo).queryByText(MESMA_FORMA)).not.toBeInTheDocument();
    expect(
      within(dialogo).getByText('A fatura de R$ 39,90 que vence em 05/12, já gerada, também passa para boleto.'),
    ).toBeInTheDocument();
  });

  it('sem fatura a vencer: "Vale a partir da próxima fatura, que vence em 05/12."', async () => {
    const { dialogo } = abrir({ faturaAVencer: undefined });
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
    expect(within(dialogo).getByText('Vale a partir da próxima fatura, que vence em 05/12.')).toBeInTheDocument();
    expect(within(dialogo).queryByText(/já gerada/)).not.toBeInTheDocument();
  });

  it('setas mudam a escolha dentro do grupo', async () => {
    const { dialogo } = abrir();
    within(dialogo).getByRole('radio', { name: 'Pix (atual)' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(within(dialogo).getByRole('radio', { name: 'Boleto' })).toBeChecked();
    expect(within(dialogo).getByRole('button', { name: 'Trocar para Boleto' })).toBeEnabled();
  });

  it('aviso do cartão só com cartão escolhido', async () => {
    const { dialogo } = abrir();
    expect(within(dialogo).queryByText(AVISO_DO_CARTAO)).not.toBeInTheDocument();

    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Cartão de crédito' }));
    expect(within(dialogo).getByText(AVISO_DO_CARTAO)).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Trocar para cartão' })).toBeEnabled();
    expect(
      within(dialogo).getByText('A fatura de R$ 39,90 que vence em 05/12, já gerada, também passa para cartão.'),
    ).toBeInTheDocument();

    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
    expect(within(dialogo).queryByText(AVISO_DO_CARTAO)).not.toBeInTheDocument();
  });

  it('saindo do cartão: "Você volta a receber o lembrete…"; quem não paga no cartão não vê a frase', async () => {
    const { dialogo } = abrir({ formaAtual: 'CREDIT_CARD' });
    expect(within(dialogo).getByRole('radio', { name: 'Cartão de crédito (atual)' })).toBeChecked();
    expect(within(dialogo).queryByText(SAINDO_DO_CARTAO)).not.toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Pix' }));
    expect(within(dialogo).getByText(SAINDO_DO_CARTAO)).toBeInTheDocument();
  });

  it('pagando por Pix e escolhendo Boleto, a frase de quem sai do cartão não aparece', async () => {
    const { dialogo } = abrir({ formaAtual: 'PIX' });
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
    expect(within(dialogo).queryByText(SAINDO_DO_CARTAO)).not.toBeInTheDocument();
  });

  it('enviando: "Trocando…", botões travados, Esc não fecha; duplo clique faz uma chamada só', async () => {
    const pedido = adiada<void>();
    servico.trocar.mockReturnValue(pedido.promessa);
    const { dialogo, onFechar, onTrocou } = abrir();
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
    // Os dois cliques no mesmo tique, antes de o React desabilitar o botão.
    const botao = within(dialogo).getByRole('button', { name: 'Trocar para Boleto' });
    act(() => {
      botao.click();
      botao.click();
    });

    expect(servico.trocar).toHaveBeenCalledTimes(1);
    expect(servico.trocar).toHaveBeenCalledWith(ID, 'BOLETO');
    expect(within(dialogo).getByRole('button', { name: 'Trocando…' })).toBeDisabled();
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(within(dialogo).getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(onFechar).not.toHaveBeenCalled();
    expect(onTrocou).not.toHaveBeenCalled();

    await act(async () => pedido.resolver(undefined));
    expect(onTrocou).toHaveBeenCalledTimes(1);
    expect(onTrocou).toHaveBeenCalledWith('BOLETO');
  });

  it('403 com permissao: MENSAGEM_SEM_PERMISSAO dentro do diálogo, nada trocado', async () => {
    servico.trocar.mockRejectedValue({
      response: { status: 403, data: { error: 'forbidden', permissao: 'portal.contrato.cancelar' } },
    });
    const { dialogo, onTrocou } = abrir();
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Trocar para Boleto' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'Você não tem permissão para fazer isso nesta empresa.',
    );
    expect(onTrocou).not.toHaveBeenCalled();
    expect(within(dialogo).getByRole('button', { name: 'Trocar para Boleto' })).toBeEnabled();
  });

  it.each([
    ['500', { response: { status: 500, data: { error: 'internal_error' } } }],
    ['409 conta_nao_ativa', { response: { status: 409, data: { error: 'conta_nao_ativa' } } }],
    ['rede', new Error('Network Error')],
  ])('erro %s: texto genérico dentro do diálogo, nada trocado', async (_nome, falha) => {
    servico.trocar.mockRejectedValue(falha);
    const { dialogo, onTrocou } = abrir();
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Trocar para Boleto' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(TEXTO_GENERICO);
    expect(onTrocou).not.toHaveBeenCalled();
  });

  it('"Cancelar" fecha sem chamar a API', async () => {
    const { dialogo, onFechar } = abrir();
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(servico.trocar).not.toHaveBeenCalled();
  });

  it('forma atual fora das três (UNDEFINED): nenhuma marcada nem "(atual)"; escolher Pix libera "Trocar para Pix"', async () => {
    const { dialogo } = abrir({ formaAtual: 'UNDEFINED' });
    expect(within(dialogo).queryByRole('radio', { name: /\(atual\)/ })).not.toBeInTheDocument();
    for (const opcao of within(dialogo).getAllByRole('radio')) expect(opcao).not.toBeChecked();
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Pix' }));
    expect(within(dialogo).getByRole('button', { name: 'Trocar para Pix' })).toBeEnabled();
  });

  describe('fatura vencida e o resultado da D-4', () => {
    const ATRASO = (forma: string) => `A fatura em atraso também passa para ${forma}.`;

    it('resultado A: com fatura vencida, "A fatura em atraso também passa para {forma}."', async () => {
      const { dialogo } = abrir({ faturaVencida: vencida, resultadoD4: 'A' });
      await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
      expect(within(dialogo).getByText(ATRASO('boleto'))).toBeInTheDocument();
    });

    it('resultado B: a frase do atraso nunca aparece', async () => {
      const { dialogo } = abrir({ faturaVencida: vencida, resultadoD4: 'B' });
      await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
      expect(within(dialogo).queryByText(/fatura em atraso/)).not.toBeInTheDocument();
    });

    it('resultado A sem fatura vencida: sem a frase do atraso', async () => {
      const { dialogo } = abrir({ resultadoD4: 'A' });
      await userEvent.click(within(dialogo).getByRole('radio', { name: 'Boleto' }));
      expect(within(dialogo).queryByText(/fatura em atraso/)).not.toBeInTheDocument();
    });
  });
});
