import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const servico = vi.hoisted(() => ({ remover: vi.fn() }));
vi.mock('@/services/usuarios', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/services/usuarios')>();
  return { ...real, UsuariosService: servico };
});

import RemoverUsuarioDialog from './RemoverUsuarioDialog';
import { bia } from '@/test/usuariosFixtures';

// gestao-de-acesso-f3-portal-cliente RF-19, RF-20, CA-10 (blueprint §5).

function abrir(onRemovido = vi.fn(), onFechar = vi.fn()) {
  render(<RemoverUsuarioDialog usuario={bia} nomeDaEmpresa="Loja da Ana" tenantId="t-1" onFechar={onFechar} onRemovido={onRemovido} />);
  return { onRemovido, onFechar };
}

describe('RemoverUsuarioDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('confirma com o nome, explica o efeito e abre com o foco em Cancelar', () => {
    abrir();
    const dialogo = screen.getByRole('dialog', { name: 'Remover Bia Lima?' });
    expect(dialogo).toHaveAccessibleDescription('A pessoa deixa de acessar Loja da Ana. Se não tiver acesso a outra empresa, a conta dela é apagada.');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('Remover chama a API e avisa', async () => {
    servico.remover.mockResolvedValue(undefined);
    const { onRemovido } = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(servico.remover).toHaveBeenCalledWith('bia@loja.com', 't-1');
    expect(onRemovido).toHaveBeenCalledWith('Bia Lima não tem mais acesso a Loja da Ana.');
  });

  const erros: [unknown, string][] = [
    [{ response: { status: 409, data: { error: 'ultimo_administrador' } } }, 'A empresa precisa de pelo menos um Administrador do Portal ativo. Promova outra pessoa antes.'],
    [{ response: { status: 404, data: { error: 'usuario_fora_da_empresa' } } }, 'Essa pessoa já não está nesta empresa. Feche e a lista será atualizada.'],
    [{ response: { status: 403, data: { error: 'proprio_usuario' } } }, 'Você não pode remover a si mesmo.'],
    [new Error('Network Error'), 'Não foi possível remover. Tente de novo.'],
  ];
  for (const [erro, texto] of erros) {
    it(`erro: "${texto}" dentro do diálogo, que continua aberto`, async () => {
      servico.remover.mockRejectedValue(erro);
      const { onRemovido, onFechar } = abrir();
      await userEvent.click(screen.getByRole('button', { name: 'Remover' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(texto);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onRemovido).not.toHaveBeenCalled();
      expect(onFechar).not.toHaveBeenCalled();
    });
  }

  it('enquanto remove, os botões ficam desabilitados', async () => {
    let resolver: () => void = () => {};
    servico.remover.mockReturnValue(new Promise<void>((r) => { resolver = r; }));
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(screen.getByRole('button', { name: /Removendo/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    resolver();
  });

  it('Cancelar fecha sem remover', async () => {
    const { onFechar } = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onFechar).toHaveBeenCalled();
    expect(servico.remover).not.toHaveBeenCalled();
  });
});
