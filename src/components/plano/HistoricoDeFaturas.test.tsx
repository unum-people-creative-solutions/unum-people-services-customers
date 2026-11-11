import { render, screen, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { planoEFaturasDaPadaria, planoEFaturasDaPadariaSemGerir } from '@/test/cobrancaFixtures';
import { simularTela } from '@/test/telaLarga';
import type { FaturaDoCliente } from '@/types/cobranca';
import HistoricoDeFaturas from './HistoricoDeFaturas';

// spec: cobranca-e-plano-do-cliente RF3-02, T57 (histórico, BP-T §9.4 e §14 "Larguras").

const vencida: FaturaDoCliente = {
  id: 'pay_4',
  valor: 39.9,
  vencimento: '2026-09-05',
  situacao: 'vencida',
  link: 'https://www.asaas.com/i/pay4',
};
const comGerir = [...planoEFaturasDaPadaria.faturas, vencida];
const NOTA_SO_QUEM_GERE = 'Os links das faturas e das notas fiscais aparecem só para quem gere o contrato.';

describe('HistoricoDeFaturas (T57)', () => {
  beforeEach(() => simularTela(true));
  afterEach(() => vi.unstubAllGlobals());

  it('tela larga: tabela "Faturas da Padaria Zé" com as cinco colunas e uma linha por fatura', () => {
    render(<HistoricoDeFaturas faturas={comGerir} podeGerir nomeDaEmpresa="Padaria Zé" />);
    expect(screen.getByRole('heading', { name: 'Histórico de faturas' })).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: 'Faturas da Padaria Zé' });
    const cabecalhos = within(tabela).getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalhos).toEqual(['Vencimento', 'Valor', 'Situação', 'Paga em', 'Ações']);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    const linhas = within(tabela).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(4);
    const celulas = (i: number) => within(linhas[i]).getAllByRole('cell').map((c) => c.textContent);
    expect(celulas(0).slice(0, 4)).toEqual(['05/12/2026', 'R$ 39,90', 'A vencer', '—']);
    expect(celulas(1).slice(0, 4)).toEqual(['05/11/2026', 'R$ 39,90', 'Paga', '04/11/2026']);
    expect(celulas(2).slice(0, 4)).toEqual(['05/10/2026', 'R$ 39,90', 'Estornada', '—']);
    expect(celulas(3).slice(0, 4)).toEqual(['05/09/2026', 'R$ 39,90', 'Vencida', '—']);
  });

  it('links "Ver fatura de…" e "Nota fiscal de…" em nova aba, só onde a API mandou', () => {
    render(<HistoricoDeFaturas faturas={comGerir} podeGerir nomeDaEmpresa="Padaria Zé" />);
    const ver = screen.getByRole('link', { name: 'Ver fatura de 05/11/2026 (abre em nova aba)' });
    expect(ver).toHaveAttribute('href', 'https://www.asaas.com/i/pay2');
    expect(ver).toHaveAttribute('target', '_blank');
    expect(ver).toHaveAttribute('rel', 'noopener noreferrer');
    const nota = screen.getByRole('link', { name: 'Nota fiscal de 05/11/2026 (abre em nova aba)' });
    expect(nota).toHaveAttribute('href', 'https://nf.example.com/pay2.pdf');
    expect(nota).toHaveAttribute('target', '_blank');
    expect(nota).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Ver fatura de 05/12/2026 (abre em nova aba)' })).toHaveAttribute(
      'href',
      'https://www.asaas.com/i/pay3',
    );
    expect(screen.queryByRole('link', { name: /Nota fiscal de 05\/12\/2026/ })).not.toBeInTheDocument();
    expect(screen.queryByText(NOTA_SO_QUEM_GERE)).not.toBeInTheDocument();
  });

  it('celular: lista de cartões, sem tabela, com chips, "paga em" e links', () => {
    simularTela(false);
    render(<HistoricoDeFaturas faturas={comGerir} podeGerir nomeDaEmpresa="Padaria Zé" />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const lista = screen.getByRole('list', { name: 'Faturas da Padaria Zé' });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(4);
    expect(within(itens[0]).getByText('A vencer')).toBeInTheDocument();
    expect(within(itens[1]).getByText('Paga')).toBeInTheDocument();
    expect(within(itens[1]).getByText('Paga em 04/11/2026')).toBeInTheDocument();
    expect(within(itens[2]).getByText('Estornada')).toBeInTheDocument();
    expect(within(itens[3]).getByText('Vencida')).toBeInTheDocument();
    expect(
      within(itens[1]).getByRole('link', { name: 'Nota fiscal de 05/11/2026 (abre em nova aba)' }),
    ).toHaveAttribute('href', 'https://nf.example.com/pay2.pdf');
    expect(
      within(itens[1]).getByRole('link', { name: 'Ver fatura de 05/11/2026 (abre em nova aba)' }),
    ).toHaveAttribute('href', 'https://www.asaas.com/i/pay2');
  });

  it('sem pode_gerir: sem coluna Ações, nenhum link e a frase sobre quem gere', () => {
    render(
      <HistoricoDeFaturas
        faturas={planoEFaturasDaPadariaSemGerir.faturas}
        podeGerir={false}
        nomeDaEmpresa="Padaria Zé"
      />,
    );
    const tabela = screen.getByRole('table', { name: 'Faturas da Padaria Zé' });
    const cabecalhos = within(tabela).getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalhos).toEqual(['Vencimento', 'Valor', 'Situação', 'Paga em']);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(NOTA_SO_QUEM_GERE)).toBeInTheDocument();
  });

  it('sem pode_gerir no celular: nenhum link e a frase sobre quem gere', () => {
    simularTela(false);
    render(
      <HistoricoDeFaturas
        faturas={planoEFaturasDaPadariaSemGerir.faturas}
        podeGerir={false}
        nomeDaEmpresa="Padaria Zé"
      />,
    );
    expect(screen.getByRole('list', { name: 'Faturas da Padaria Zé' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(NOTA_SO_QUEM_GERE)).toBeInTheDocument();
  });

  it('vazio: "Nenhuma fatura ainda. A primeira aparece aqui quando for gerada.", sem tabela', () => {
    render(<HistoricoDeFaturas faturas={[]} podeGerir nomeDaEmpresa="Padaria Zé" />);
    expect(screen.getByText('Nenhuma fatura ainda. A primeira aparece aqui quando for gerada.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
