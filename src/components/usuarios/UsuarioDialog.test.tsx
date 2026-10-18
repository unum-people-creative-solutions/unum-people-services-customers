import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const servico = vi.hoisted(() => ({ convidar: vi.fn(), atualizar: vi.fn() }));
vi.mock('@/services/usuarios', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/services/usuarios')>();
  return { ...real, UsuariosService: servico };
});

import UsuarioDialog from './UsuarioDialog';
import { ana, bia, caio, papeisDaLoja } from '@/test/usuariosFixtures';

// gestao-de-acesso-f3-portal-cliente RF-18, CA-10 (blueprint §4).

function convidar(onSalvo = vi.fn(), onFechar = vi.fn(), maximo: number | null = 5) {
  render(<UsuarioDialog modo="convidar" papeis={papeisDaLoja} tenantId="t-1" maximo={maximo} onFechar={onFechar} onSalvo={onSalvo} />);
  return { onSalvo, onFechar };
}

function editar(usuario = bia, ehVoce = false, onSalvo = vi.fn()) {
  render(<UsuarioDialog modo="editar" usuario={usuario} ehVoce={ehVoce} papeis={papeisDaLoja} tenantId="t-1" maximo={5} onFechar={vi.fn()} onSalvo={onSalvo} />);
  return { onSalvo };
}

const enviar = () => screen.getByRole('button', { name: 'Enviar convite' });
const salvar = () => screen.getByRole('button', { name: 'Salvar alterações' });

describe('UsuarioDialog — convidar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('abre como diálogo "Convidar pessoa", com os padrões Membro e Automático e o aviso do e-mail', () => {
    convidar();
    expect(screen.getByRole('dialog', { name: 'Convidar pessoa' })).toBeInTheDocument();
    expect(screen.getByLabelText('Portal do Cliente')).toHaveValue('membro');
    expect(screen.getByLabelText('CRM')).toHaveValue('');
    expect(screen.getByText('A pessoa recebe um e-mail com uma senha temporária para entrar.')).toBeInTheDocument();
  });

  it('abre com o foco no campo Nome', () => {
    convidar();
    expect(screen.getByLabelText('Nome')).toHaveFocus();
  });

  it('o botão desabilitado diz o motivo', async () => {
    convidar();
    expect(enviar()).toBeDisabled();
    expect(enviar()).toHaveAccessibleDescription('Preencha o nome.');
    await userEvent.type(screen.getByLabelText('Nome'), 'Bia Lima');
    expect(enviar()).toHaveAccessibleDescription('Preencha o e-mail.');
    await userEvent.type(screen.getByLabelText('E-mail'), 'bia@');
    expect(enviar()).toHaveAccessibleDescription('E-mail inválido.');
    await userEvent.type(screen.getByLabelText('E-mail'), 'loja.com');
    expect(enviar()).toBeEnabled();
  });

  it('envia nome e e-mail sem espaços, Portal e só os papéis escolhidos', async () => {
    servico.convidar.mockResolvedValue(bia);
    const { onSalvo } = convidar();
    await userEvent.type(screen.getByLabelText('Nome'), '  Bia Lima ');
    await userEvent.type(screen.getByLabelText('E-mail'), ' bia@loja.com ');
    await userEvent.click(enviar());
    expect(servico.convidar).toHaveBeenCalledWith({ email: 'bia@loja.com', nome: 'Bia Lima', acessos: { portal: 'membro' } }, 't-1');
    expect(onSalvo).toHaveBeenCalledWith('Convite enviado para bia@loja.com.');
  });

  it('papel escolhido no CRM vai no convite', async () => {
    servico.convidar.mockResolvedValue(bia);
    convidar();
    await userEvent.type(screen.getByLabelText('Nome'), 'Bia');
    await userEvent.type(screen.getByLabelText('E-mail'), 'bia@loja.com');
    await userEvent.selectOptions(screen.getByLabelText('CRM'), 'vendedor');
    await userEvent.click(enviar());
    expect(servico.convidar).toHaveBeenCalledWith({ email: 'bia@loja.com', nome: 'Bia', acessos: { portal: 'membro', crm: 'vendedor' } }, 't-1');
  });

  const erros: [number, string, string][] = [
    [409, 'ja_vinculado', 'Essa pessoa já tem acesso a esta empresa. Para mudar o que ela pode fazer, use Editar.'],
    [422, 'limite_de_usuarios', 'Seu plano permite 5 usuários. Remova alguém para convidar outra pessoa.'],
    [400, 'papel_invalido', 'Uma das escolhas não vale mais. Recarregue a página e tente de novo.'],
    [500, 'interno', 'Não foi possível salvar. Tente de novo.'],
  ];
  for (const [status, codigo, texto] of erros) {
    it(`${status} ${codigo}: a mensagem fica na caixa, que continua aberta`, async () => {
      servico.convidar.mockRejectedValue({ response: { status, data: { error: codigo } } });
      const { onSalvo, onFechar } = convidar();
      await userEvent.type(screen.getByLabelText('Nome'), 'Bia');
      await userEvent.type(screen.getByLabelText('E-mail'), 'bia@loja.com');
      await userEvent.click(enviar());
      expect(await screen.findByRole('alert')).toHaveTextContent(texto);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onSalvo).not.toHaveBeenCalled();
      expect(onFechar).not.toHaveBeenCalled();
    });
  }

  it('erro de rede: mensagem genérica', async () => {
    servico.convidar.mockRejectedValue(new Error('Network Error'));
    convidar();
    await userEvent.type(screen.getByLabelText('Nome'), 'Bia');
    await userEvent.type(screen.getByLabelText('E-mail'), 'bia@loja.com');
    await userEvent.click(enviar());
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
  });

  it('enquanto envia, os botões ficam desabilitados', async () => {
    let resolver: (v: unknown) => void = () => {};
    servico.convidar.mockReturnValue(new Promise((r) => { resolver = r; }));
    convidar();
    await userEvent.type(screen.getByLabelText('Nome'), 'Bia');
    await userEvent.type(screen.getByLabelText('E-mail'), 'bia@loja.com');
    await userEvent.click(enviar());
    expect(screen.getByRole('button', { name: /Enviando/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    resolver(bia);
  });

  it('Cancelar fecha sem enviar', async () => {
    const { onFechar } = convidar();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onFechar).toHaveBeenCalled();
    expect(servico.convidar).not.toHaveBeenCalled();
  });
});

describe('UsuarioDialog — editar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('título com o nome, e-mail só para leitura, valores atuais e implícito como Automático', () => {
    editar(caio);
    expect(screen.getByRole('dialog', { name: 'Caio Reis' })).toBeInTheDocument();
    expect(screen.getByText('caio@loja.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Caio Reis');
    expect(screen.getByLabelText('Portal do Cliente')).toHaveValue('membro');
    expect(screen.getByLabelText('CRM')).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: 'Bloquear o acesso a esta empresa' })).toBeChecked();
    expect(screen.getByText('A pessoa continua na lista, mas não entra até você desbloquear.')).toBeInTheDocument();
  });

  it('sem mudança, Salvar fica desabilitado com o motivo', () => {
    editar();
    expect(salvar()).toBeDisabled();
    expect(salvar()).toHaveAccessibleDescription('Nada para salvar.');
  });

  it('envia só o que mudou', async () => {
    servico.atualizar.mockResolvedValue(bia);
    const { onSalvo } = editar();
    await userEvent.selectOptions(screen.getByLabelText('CRM'), 'gestor');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Bloquear o acesso a esta empresa' }));
    await userEvent.click(salvar());
    expect(servico.atualizar).toHaveBeenCalledWith('bia@loja.com', { acessos: { crm: 'gestor' }, status: 'bloqueado' }, 't-1');
    expect(onSalvo).toHaveBeenCalledWith('Alterações salvas.');
  });

  it('voltar para Automático manda "" (remove o papel gravado); nome muda sem espaços', async () => {
    servico.atualizar.mockResolvedValue(bia);
    editar();
    await userEvent.selectOptions(screen.getByLabelText('CRM'), '');
    const nome = screen.getByLabelText('Nome');
    await userEvent.clear(nome);
    await userEvent.type(nome, ' Bia L. ');
    await userEvent.click(salvar());
    expect(servico.atualizar).toHaveBeenCalledWith('bia@loja.com', { nome: 'Bia L.', acessos: { crm: '' } }, 't-1');
  });

  it('nome apagado: Salvar desabilitado com o motivo', async () => {
    editar();
    await userEvent.clear(screen.getByLabelText('Nome'));
    expect(salvar()).toBeDisabled();
    expect(salvar()).toHaveAccessibleDescription('Preencha o nome.');
  });

  it('própria conta: Portal e bloqueio desabilitados, com o motivo; nome e CRM editáveis', async () => {
    servico.atualizar.mockResolvedValue(ana);
    editar(ana, true);
    expect(screen.getByLabelText('Portal do Cliente')).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Bloquear o acesso a esta empresa' })).toBeDisabled();
    // O motivo aparece uma vez só, e não repetido no bloqueio e no Portal.
    expect(screen.getAllByText('Você não pode mudar o seu próprio acesso ao Portal nem se bloquear.')).toHaveLength(1);
    // Verifier da fase 3, G4: os dois controles desabilitados apontam para o motivo.
    expect(screen.getByRole('checkbox', { name: 'Bloquear o acesso a esta empresa' })).toHaveAccessibleDescription(
      expect.stringContaining('Você não pode mudar o seu próprio acesso ao Portal nem se bloquear.'),
    );
    expect(screen.getByLabelText('Portal do Cliente')).toHaveAccessibleDescription(
      expect.stringContaining('Você não pode mudar o seu próprio acesso ao Portal nem se bloquear.'),
    );
    await userEvent.selectOptions(screen.getByLabelText('CRM'), 'vendedor');
    await userEvent.click(salvar());
    expect(servico.atualizar).toHaveBeenCalledWith('ana@loja.com', { acessos: { crm: 'vendedor' } }, 't-1');
  });

  const erros: [number, string, string][] = [
    [409, 'ultimo_administrador', 'A empresa precisa de pelo menos um Administrador do Portal ativo. Promova outra pessoa antes.'],
    [403, 'proprio_usuario', 'Você não pode mudar o seu próprio acesso ao Portal nem se bloquear.'],
    [400, 'papel_invalido', 'Uma das escolhas não vale mais. Recarregue a página e tente de novo.'],
  ];
  for (const [status, codigo, texto] of erros) {
    it(`${status} ${codigo}: a mensagem fica na caixa`, async () => {
      servico.atualizar.mockRejectedValue({ response: { status, data: { error: codigo } } });
      const { onSalvo } = editar(ana);
      await userEvent.selectOptions(screen.getByLabelText('Portal do Cliente'), 'membro');
      await userEvent.click(salvar());
      expect(await screen.findByRole('alert')).toHaveTextContent(texto);
      expect(onSalvo).not.toHaveBeenCalled();
    });
  }
});
