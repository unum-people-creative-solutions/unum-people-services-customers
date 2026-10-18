import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { useState } from 'react';
import AcessosPorFerramenta from './AcessosPorFerramenta';
import { papeisDaLoja } from '@/test/usuariosFixtures';

// gestao-de-acesso-f3-portal-cliente RF-18, CA-10 (blueprint §4).

function Controlado({ inicial, onChange = vi.fn(), portalBloqueado = false }: { inicial: Record<string, string>; onChange?: (v: Record<string, string>) => void; portalBloqueado?: boolean }) {
  const [valor, setValor] = useState(inicial);
  return (
    <AcessosPorFerramenta
      papeis={papeisDaLoja}
      valor={valor}
      portalBloqueado={portalBloqueado}
      motivoPortalBloqueado="Você não pode mudar o seu próprio acesso ao Portal nem se bloquear."
      onChange={(v) => {
        onChange(v);
        setValor(v);
      }}
    />
  );
}

describe('AcessosPorFerramenta', () => {
  it('um grupo com o Portal e só as ferramentas contratadas', () => {
    render(<Controlado inicial={{ portal: 'membro', crm: '' }} />);
    const grupo = screen.getByRole('group', { name: 'O que a pessoa pode fazer' });
    const selects = within(grupo).getAllByRole('combobox');
    expect(selects.map((s) => s.getAttribute('aria-label') ?? (s as HTMLSelectElement).labels?.[0]?.textContent)).toEqual(['Portal do Cliente', 'CRM']);
    expect(screen.queryByLabelText('Blog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Páginas')).not.toBeInTheDocument();
  });

  it('o Portal lista os papéis do Portal, sem "Sem acesso" nem Automático', () => {
    render(<Controlado inicial={{ portal: 'membro', crm: '' }} />);
    const opcoes = within(screen.getByLabelText('Portal do Cliente')).getAllByRole('option').map((o) => o.textContent);
    expect(opcoes).toEqual(['Administrador', 'Membro']);
  });

  it('a ferramenta começa com Automático (X), depois os papéis, inclusive personalizados', () => {
    render(<Controlado inicial={{ portal: 'membro', crm: '' }} />);
    const crm = screen.getByLabelText('CRM') as HTMLSelectElement;
    const opcoes = within(crm).getAllByRole('option');
    expect(opcoes.map((o) => o.textContent)).toEqual(['Automático (Sem acesso)', 'Gestor', 'Vendedor', 'Sem acesso', 'Atendente']);
    expect(opcoes[0]).toHaveValue('');
    expect(crm).toHaveValue('');
  });

  it('o X do Automático muda na hora quando o Portal muda', async () => {
    const onChange = vi.fn();
    render(<Controlado inicial={{ portal: 'membro', crm: '' }} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Portal do Cliente'), 'administrador');
    expect(onChange).toHaveBeenLastCalledWith({ portal: 'administrador', crm: '' });
    expect(within(screen.getByLabelText('CRM')).getAllByRole('option')[0]).toHaveTextContent('Automático (Gestor)');
  });

  it('abaixo de cada seletor, o que o papel escolhido permite', async () => {
    render(<Controlado inicial={{ portal: 'membro', crm: '' }} />);
    expect(screen.getByLabelText('Portal do Cliente')).toHaveAccessibleDescription('Ver a empresa, os produtos e o contrato.');
    expect(screen.getByLabelText('CRM')).toHaveAccessibleDescription('Não entra no CRM.');
    await userEvent.selectOptions(screen.getByLabelText('CRM'), 'vendedor');
    expect(screen.getByLabelText('CRM')).toHaveAccessibleDescription('Ver e buscar leads, Criar lead, Editar lead e registrar venda.');
    await userEvent.selectOptions(screen.getByLabelText('Portal do Cliente'), 'administrador');
    await userEvent.selectOptions(screen.getByLabelText('CRM'), '');
    expect(screen.getByLabelText('CRM')).toHaveAccessibleDescription('Ver e buscar leads, Criar lead, Editar lead e registrar venda, Excluir lead, Conectar o Google Ads.');
  });

  it('escolher papel muda só aquela ferramenta', async () => {
    const onChange = vi.fn();
    render(<Controlado inicial={{ portal: 'membro', crm: '' }} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('CRM'), 'p-aaaaaaaaaaaa');
    expect(onChange).toHaveBeenLastCalledWith({ portal: 'membro', crm: 'p-aaaaaaaaaaaa' });
  });

  it('Portal bloqueado: desabilitado, com o motivo', () => {
    render(<Controlado inicial={{ portal: 'administrador', crm: '' }} portalBloqueado />);
    expect(screen.getByLabelText('Portal do Cliente')).toBeDisabled();
    expect(screen.getByText('Você não pode mudar o seu próprio acesso ao Portal nem se bloquear.')).toBeInTheDocument();
    expect(screen.getByLabelText('CRM')).toBeEnabled();
  });
});
