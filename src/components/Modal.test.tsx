import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { useRef, useState } from 'react';
import Modal from './Modal';

// gestao-de-acesso-f3-portal-cliente RF-20, CA-10: diálogo do Portal com foco preso, Esc e devolução do foco.

function Exemplo({ bloqueado = false, onFechar = vi.fn(), comFocoInicial = false }) {
  const [aberto, setAberto] = useState(false);
  const cancelar = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button onClick={() => setAberto(true)}>Abrir</button>
      <Modal
        aberto={aberto}
        titulo="Remover Bia?"
        descricao="Ela deixa de acessar a empresa."
        fecharBloqueado={bloqueado}
        focoInicialRef={comFocoInicial ? cancelar : undefined}
        onFechar={() => {
          onFechar();
          setAberto(false);
        }}
      >
        <input aria-label="Nome" />
        <button ref={cancelar}>Cancelar</button>
        <button>Remover</button>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('fechado não renderiza nada', () => {
    render(<Exemplo />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('aberto é um diálogo modal com título e descrição ligados', async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialogo = screen.getByRole('dialog', { name: 'Remover Bia?' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleDescription('Ela deixa de acessar a empresa.');
    expect(screen.getByRole('heading', { name: 'Remover Bia?' })).toBeInTheDocument();
  });

  it('o foco vai ao primeiro elemento focável, ou ao indicado', async () => {
    const { unmount } = render(<Exemplo />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    unmount();

    render(<Exemplo comFocoInicial />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('Tab e Shift+Tab ficam presos dentro do diálogo', async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    screen.getByRole('button', { name: 'Remover' }).focus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Remover' })).toHaveFocus();
  });

  it('Esc e o botão Fechar fecham, e o foco volta a quem abriu', async () => {
    const onFechar = vi.fn();
    render(<Exemplo onFechar={onFechar} />);
    const abrir = screen.getByRole('button', { name: 'Abrir' });
    await userEvent.click(abrir);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();

    await userEvent.click(abrir);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onFechar).toHaveBeenCalledTimes(2);
    expect(abrir).toHaveFocus();
  });

  it('com fecharBloqueado (enviando), Esc e Fechar não fecham', async () => {
    const onFechar = vi.fn();
    render(<Exemplo bloqueado onFechar={onFechar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
