import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { FaturaDoCliente, ResumoDeCobranca } from '@/types/cobranca';
import { resumoEmAtraso, resumoEmAtrasoAntesDoParcial, resumoEmDia } from '@/test/cobrancaFixtures';

// spec: cobranca-e-plano-do-cliente RF3-02, T56 ("Fatura em aberto", BP-T §9.3) e a
// espera do pagamento da F2 (RF2-33) pelo useEsperaDoPagamento.

const cobranca = vi.hoisted(() => ({
  resumo: null as ResumoDeCobranca | null,
  carregando: false,
  erro: false,
  recarregar: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/contexts/CobrancaContext', () => ({ useCobranca: () => cobranca }));
vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => ({ activeTenantId: '3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b', activeTenantName: 'Padaria Zé' }),
}));

import FaturaEmAberto from './FaturaEmAberto';

const vencida: FaturaDoCliente = {
  id: 'pay_2',
  valor: 39.9,
  vencimento: '2026-11-05',
  situacao: 'vencida',
  link: 'https://www.asaas.com/i/pay2',
};
const aVencer: FaturaDoCliente = {
  id: 'pay_3',
  valor: 39.9,
  vencimento: '2026-12-05',
  situacao: 'a_vencer',
  link: 'https://www.asaas.com/i/pay3',
};
const paga: FaturaDoCliente = {
  id: 'pay_1',
  valor: 39.9,
  vencimento: '2026-10-05',
  situacao: 'paga',
  pago_em: '2026-10-04',
  link: 'https://www.asaas.com/i/pay1',
};
const estornada: FaturaDoCliente = { id: 'pay_0', valor: 39.9, vencimento: '2026-09-05', situacao: 'estornada' };

function secao() {
  return within(screen.getByRole('heading', { name: 'Fatura em aberto' }).closest('section') as HTMLElement);
}

async function clicarEmPagar() {
  const pagar = screen.getByRole('link', { name: /Pagar fatura/ });
  // O link abre o Asaas em outra aba; aqui só interessa o que a seção faz.
  pagar.addEventListener('click', (e) => e.preventDefault(), { once: true });
  await act(async () => {
    fireEvent.click(pagar);
  });
}

describe('FaturaEmAberto (T56)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    cobranca.resumo = resumoEmAtraso;
  });

  it('vencida: valor e "venceu em", chip "Vencida" e "Pagar fatura" em nova aba', () => {
    render(<FaturaEmAberto faturas={[paga, vencida]} formaDePagamento="PIX" aoConfirmarPagamento={vi.fn()} />);
    expect(secao().getByText('R$ 39,90 · venceu em 05/11/2026')).toBeInTheDocument();
    expect(secao().getByText('Vencida')).toBeInTheDocument();
    const pagar = secao().getByRole('link', { name: 'Pagar fatura (abre em nova aba)' });
    expect(pagar).toHaveAttribute('href', 'https://www.asaas.com/i/pay2');
    expect(pagar).toHaveAttribute('target', '_blank');
    expect(pagar).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('a vencida tem a vez mesmo depois de uma a vencer mais nova na lista', () => {
    render(<FaturaEmAberto faturas={[aVencer, vencida]} formaDePagamento="PIX" aoConfirmarPagamento={vi.fn()} />);
    expect(secao().getByText('R$ 39,90 · venceu em 05/11/2026')).toBeInTheDocument();
    expect(secao().queryByText(/vence em 05\/12\/2026/)).not.toBeInTheDocument();
  });

  // DV-46: a "Fatura em aberto" é a vencida de vencimento mais antigo, a mesma da faixa e de
  // /me/cobranca (R6: duas vencidas antes do pagamento parcial).
  it('duas vencidas: mostra a mais antiga e "Pagar fatura" leva a "Aguardando a confirmação do pagamento"', async () => {
    cobranca.resumo = resumoEmAtrasoAntesDoParcial;
    const vencida0510: FaturaDoCliente = {
      id: 'pay_1',
      valor: 39.9,
      vencimento: '2026-10-05',
      situacao: 'vencida',
      link: 'https://www.asaas.com/i/abc',
    };
    const aoConfirmar = vi.fn();
    render(
      <FaturaEmAberto faturas={[vencida, vencida0510]} formaDePagamento="PIX" aoConfirmarPagamento={aoConfirmar} />,
    );
    expect(secao().getByText('R$ 39,90 · venceu em 05/10/2026')).toBeInTheDocument();
    expect(secao().queryByText(/05\/11\/2026/)).not.toBeInTheDocument();
    expect(secao().getByRole('link', { name: 'Pagar fatura (abre em nova aba)' })).toHaveAttribute(
      'href',
      'https://www.asaas.com/i/abc',
    );

    await clicarEmPagar();
    expect(secao().getByRole('status')).toHaveTextContent('Aguardando a confirmação do pagamento');
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  // DV-46: sem vencida, a a_vencer de vencimento mais próximo.
  it('duas a vencer: mostra a de vencimento mais próximo', () => {
    const aVencer0501: FaturaDoCliente = {
      id: 'pay_4',
      valor: 39.9,
      vencimento: '2027-01-05',
      situacao: 'a_vencer',
      link: 'https://www.asaas.com/i/pay4',
    };
    render(<FaturaEmAberto faturas={[aVencer0501, aVencer, paga]} formaDePagamento="PIX" aoConfirmarPagamento={vi.fn()} />);
    expect(secao().getByText('R$ 39,90 · vence em 05/12/2026')).toBeInTheDocument();
    expect(secao().getByRole('link', { name: 'Pagar fatura (abre em nova aba)' })).toHaveAttribute(
      'href',
      'https://www.asaas.com/i/pay3',
    );
  });

  it('vencida: ao clicar em "Pagar fatura", "Aguardando a confirmação do pagamento"', async () => {
    render(<FaturaEmAberto faturas={[vencida]} formaDePagamento="PIX" aoConfirmarPagamento={vi.fn()} />);
    await clicarEmPagar();
    expect(secao().getByRole('status')).toHaveTextContent('Aguardando a confirmação do pagamento');
    expect(secao().getByRole('link', { name: /Pagar fatura/ })).toBeInTheDocument();
  });

  it('pagamento confirmado (resumo em dia): pede para reler as faturas', async () => {
    const aoConfirmar = vi.fn();
    const { rerender } = render(
      <FaturaEmAberto faturas={[vencida]} formaDePagamento="PIX" aoConfirmarPagamento={aoConfirmar} />,
    );
    await clicarEmPagar();
    expect(aoConfirmar).not.toHaveBeenCalled();

    cobranca.resumo = resumoEmDia;
    await act(async () => {
      rerender(<FaturaEmAberto faturas={[vencida]} formaDePagamento="PIX" aoConfirmarPagamento={aoConfirmar} />);
    });
    expect(aoConfirmar).toHaveBeenCalledTimes(1);
  });

  it('pagamento parcial (outra fatura ainda em atraso): pede para reler as faturas', async () => {
    const aoConfirmar = vi.fn();
    const { rerender } = render(
      <FaturaEmAberto faturas={[vencida]} formaDePagamento="PIX" aoConfirmarPagamento={aoConfirmar} />,
    );
    await clicarEmPagar();

    cobranca.resumo = { ...resumoEmAtraso, fatura: { valor: 39.9, vencimento: '2026-12-05', link: 'https://www.asaas.com/i/pay3' } };
    await act(async () => {
      rerender(<FaturaEmAberto faturas={[vencida]} formaDePagamento="PIX" aoConfirmarPagamento={aoConfirmar} />);
    });
    expect(aoConfirmar).toHaveBeenCalledTimes(1);
  });

  it.each([['PIX'], ['BOLETO']])('a vencer no %s: "vence em", chip "A vencer" e "Pagar fatura"', (forma) => {
    render(<FaturaEmAberto faturas={[aVencer, paga]} formaDePagamento={forma} aoConfirmarPagamento={vi.fn()} />);
    expect(secao().getByText('R$ 39,90 · vence em 05/12/2026')).toBeInTheDocument();
    expect(secao().getByText('A vencer')).toBeInTheDocument();
    const pagar = secao().getByRole('link', { name: 'Pagar fatura (abre em nova aba)' });
    expect(pagar).toHaveAttribute('href', 'https://www.asaas.com/i/pay3');
    expect(pagar).toHaveAttribute('target', '_blank');
  });

  it('a vencer no cartão: "será cobrada no cartão em" e "Ver fatura", sem "Pagar fatura"', () => {
    render(<FaturaEmAberto faturas={[aVencer]} formaDePagamento="CREDIT_CARD" aoConfirmarPagamento={vi.fn()} />);
    expect(secao().getByText('R$ 39,90 · será cobrada no cartão em 05/12/2026')).toBeInTheDocument();
    const ver = secao().getByRole('link', { name: 'Ver fatura (abre em nova aba)' });
    expect(ver).toHaveAttribute('href', 'https://www.asaas.com/i/pay3');
    expect(ver).toHaveAttribute('target', '_blank');
    expect(secao().queryByRole('link', { name: /Pagar fatura/ })).not.toBeInTheDocument();
  });

  it('vencida sem link (quem não gere): "Avise o responsável pela conta" e nenhum link', () => {
    const { link: _link, ...semLink } = vencida;
    render(<FaturaEmAberto faturas={[semLink]} formaDePagamento="PIX" aoConfirmarPagamento={vi.fn()} />);
    expect(secao().getByText('R$ 39,90 · venceu em 05/11/2026')).toBeInTheDocument();
    expect(secao().getByText('Avise o responsável pela conta')).toBeInTheDocument();
    expect(secao().queryByRole('link')).not.toBeInTheDocument();
  });

  it('a vencer sem link: o valor e a data, nenhuma ação', () => {
    const { link: _link, ...semLink } = aVencer;
    render(<FaturaEmAberto faturas={[semLink]} formaDePagamento="PIX" aoConfirmarPagamento={vi.fn()} />);
    expect(secao().getByText('R$ 39,90 · vence em 05/12/2026')).toBeInTheDocument();
    expect(secao().queryByRole('link')).not.toBeInTheDocument();
    expect(secao().queryByText('Avise o responsável pela conta')).not.toBeInTheDocument();
  });

  it.each([
    ['só paga e estornada', [paga, estornada]],
    ['lista vazia', []],
  ])('nenhuma em aberto (%s): "Nenhuma fatura em aberto."', (_caso, faturas) => {
    render(<FaturaEmAberto faturas={faturas} formaDePagamento="PIX" aoConfirmarPagamento={vi.fn()} />);
    expect(secao().getByText('Nenhuma fatura em aberto.')).toBeInTheDocument();
    expect(secao().queryByRole('link')).not.toBeInTheDocument();
  });
});
