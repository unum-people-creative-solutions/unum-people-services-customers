import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ListaDeUsuarios from './ListaDeUsuarios';
import { ana, bia, caio, papeisDaLoja } from '@/test/usuariosFixtures';
import { simularTela } from '@/test/telaLarga';
import type { UsuarioDaEmpresa } from '@/services/usuarios';

// gestao-de-acesso-f3-portal-cliente RF-17, RF-19, CA-10 (blueprint §3, §5).

function lista(usuarios: UsuarioDaEmpresa[], emailLogado = 'ana@loja.com', onEditar = vi.fn(), onRemover = vi.fn()) {
  render(<ListaDeUsuarios usuarios={usuarios} papeis={papeisDaLoja} emailLogado={emailLogado} nomeDaEmpresa="Loja da Ana" onEditar={onEditar} onRemover={onRemover} />);
  return { onEditar, onRemover };
}

const dani: UsuarioDaEmpresa = { ...ana, email: 'dani@loja.com', nome: 'Dani Prado' };
const DESCRICAO_UNICO = 'Único administrador ativo. Promova outra pessoa antes de remover.';

describe('ListaDeUsuarios — tela larga', () => {
  beforeEach(() => simularTela(true));
  afterEach(() => vi.unstubAllGlobals());

  it('tabela com Portal, só as ferramentas contratadas, Situação e Ações', () => {
    lista([bia, caio, ana]);
    const tabela = screen.getByRole('table', { name: 'Usuários da Loja da Ana' });
    const cabecalhos = within(tabela).getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalhos).toEqual(['Pessoa', 'Portal do Cliente', 'CRM', 'Situação', 'Ações']);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('a pessoa logada primeiro, marcada (você); depois por nome', () => {
    lista([caio, bia, ana]);
    const linhas = screen.getAllByRole('row').slice(1);
    expect(linhas.map((l) => within(l).getAllByRole('cell')[0].textContent)).toEqual([
      'Ana Souza (você)ana@loja.com',
      'Bia Limabia@loja.com',
      'Caio Reiscaio@loja.com',
    ]);
  });

  it('papéis pelo nome; implícito de administrador marcado com ¹ e nota de rodapé', () => {
    lista([ana, bia, caio]);
    const [linhaAna, linhaBia, linhaCaio] = screen.getAllByRole('row').slice(1);
    const celulasAna = within(linhaAna).getAllByRole('cell');
    expect(celulasAna[1]).toHaveTextContent(/^Administrador$/);
    expect(celulasAna[2]).toHaveTextContent('Gestor¹');
    expect(within(celulasAna[2]).getByText('acesso completo por ser administrador')).toBeInTheDocument();
    expect(within(linhaBia).getAllByRole('cell')[2]).toHaveTextContent(/^Vendedor$/);
    // Implícito de membro é "Sem acesso", sem marca.
    expect(within(linhaCaio).getAllByRole('cell')[2]).toHaveTextContent(/^Sem acesso$/);
    expect(screen.getByText('¹ Acesso completo por ser Administrador do Portal.')).toBeInTheDocument();
  });

  it('sem nenhum implícito de administrador, sem nota de rodapé', () => {
    lista([bia, caio], 'bia@loja.com');
    expect(screen.queryByText(/Acesso completo por ser Administrador do Portal/)).not.toBeInTheDocument();
  });

  it('situação em texto', () => {
    lista([ana, caio]);
    const [linhaAna, linhaCaio] = screen.getAllByRole('row').slice(1);
    expect(within(linhaAna).getByText('Ativo')).toBeInTheDocument();
    expect(within(linhaCaio).getByText('Bloqueado')).toBeInTheDocument();
  });

  it('Editar e Remover por linha; a própria linha não tem Remover', async () => {
    const { onEditar, onRemover } = lista([ana, bia, caio]);
    expect(screen.queryByRole('button', { name: 'Remover Ana Souza' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Editar Ana Souza' }));
    expect(onEditar).toHaveBeenCalledWith(ana);
    await userEvent.click(screen.getByRole('button', { name: 'Remover Bia Lima' }));
    expect(onRemover).toHaveBeenCalledWith(bia);
  });

  it('único administrador ativo: Remover desabilitado, com o motivo', () => {
    lista([ana, bia], 'bia@loja.com');
    const remover = screen.getByRole('button', { name: 'Remover Ana Souza' });
    expect(remover).toBeDisabled();
    expect(remover).toHaveAccessibleDescription(DESCRICAO_UNICO);
  });

  it('com outro administrador ativo, Remover habilitado; administrador bloqueado não conta', () => {
    const { unmount } = render(<ListaDeUsuarios usuarios={[ana, dani, bia]} papeis={papeisDaLoja} emailLogado="bia@loja.com" nomeDaEmpresa="Loja da Ana" onEditar={vi.fn()} onRemover={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Remover Ana Souza' })).toBeEnabled();
    unmount();
    lista([ana, { ...dani, status: 'bloqueado' }, bia], 'bia@loja.com');
    expect(screen.getByRole('button', { name: 'Remover Ana Souza' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remover Dani Prado' })).toBeEnabled();
  });
});

describe('ListaDeUsuarios — celular', () => {
  beforeEach(() => simularTela(false));
  afterEach(() => vi.unstubAllGlobals());

  it('um cartão por pessoa, sem tabela, com os papéis e as ações', async () => {
    const { onEditar } = lista([bia, ana]);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const itens = within(screen.getByRole('list', { name: 'Usuários da Loja da Ana' })).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(within(itens[0]).getByRole('heading', { name: 'Ana Souza (você)' })).toBeInTheDocument();
    const cartaoBia = itens[1];
    expect(within(cartaoBia).getByText('bia@loja.com')).toBeInTheDocument();
    expect(within(cartaoBia).getByText('Portal do Cliente')).toBeInTheDocument();
    expect(within(cartaoBia).getByText('Membro')).toBeInTheDocument();
    expect(within(cartaoBia).getByText('CRM')).toBeInTheDocument();
    expect(within(cartaoBia).getByText('Vendedor')).toBeInTheDocument();
    expect(within(cartaoBia).getByText('Ativo')).toBeInTheDocument();
    expect(within(cartaoBia).getByRole('button', { name: 'Remover Bia Lima' })).toHaveTextContent('Remover');
    await userEvent.click(within(cartaoBia).getByRole('button', { name: 'Editar Bia Lima' }));
    expect(onEditar).toHaveBeenCalledWith(bia);
    expect(screen.getByText('¹ Acesso completo por ser Administrador do Portal.')).toBeInTheDocument();
  });
});
