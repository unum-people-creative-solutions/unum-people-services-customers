import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SecaoVoce from './SecaoVoce';
import { PerfilService } from '@/services/meusDados';
import type { Perfil } from '@/types/meusDados';

vi.mock('@/services/meusDados', () => ({
  PerfilService: {
    ler: vi.fn(),
    salvarNome: vi.fn(),
  },
}));

vi.mock('@/lib/pkce', () => ({
  buildForgotPasswordUrl: vi.fn(
    () => 'https://auth.unumpeople.com.br/forgotPassword?client_id=cid&response_type=code&scope=openid+email+profile&redirect_uri=https%3A%2F%2Fcustomers.unumpeople.com.br%2Fauth%2Fcallback',
  ),
}));

const mockPerfilBase: Perfil = {
  nome: 'Fulano de Tal',
  email: 'fulano@exemplo.com.br',
  empresas: [
    { id: 'emp-1', nome_negocio: 'Empresa Alfa', papel_portal: 'Administrador' },
    { id: 'emp-2', nome_negocio: 'Empresa Beta', papel_portal: 'Membro' },
  ],
};

describe('SecaoVoce (TASK-FE-301, RF-DNG-30, T18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza os campos da seção Você corretamente', () => {
    render(<SecaoVoce perfilInicial={mockPerfilBase} />);

    // Nome editável
    const nomeInput = screen.getByLabelText(/^nome$/i);
    expect(nomeInput).toHaveValue('Fulano de Tal');

    // Botão salvar próprio
    expect(screen.getByRole('button', { name: /^salvar$/i })).toBeInTheDocument();

    // E-mail só leitura com a nota "É o seu login."
    expect(screen.getByText('fulano@exemplo.com.br')).toBeInTheDocument();
    expect(screen.getByText('É o seu login.')).toBeInTheDocument();
    // Não pode haver textbox para o e-mail
    expect(screen.queryByRole('textbox', { name: /e-mail/i })).toBeNull();

    // Link Trocar senha
    const linkTrocarSenha = screen.getByRole('link', { name: /trocar senha/i });
    expect(linkTrocarSenha).toHaveAttribute(
      'href',
      expect.stringContaining('/forgotPassword'),
    );

    // Suas empresas
    expect(screen.getByText('Suas empresas')).toBeInTheDocument();
    expect(screen.getByText('Empresa Alfa')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Empresa Beta')).toBeInTheDocument();
    expect(screen.getByText('Membro')).toBeInTheDocument();
  });

  it('salva o nome com sucesso e mostra "Dados salvos." em role="status"', async () => {
    const user = userEvent.setup();
    vi.mocked(PerfilService.salvarNome).mockResolvedValueOnce({
      ...mockPerfilBase,
      nome: 'Fulano Silva',
    });

    render(<SecaoVoce perfilInicial={mockPerfilBase} />);

    const nomeInput = screen.getByLabelText(/^nome$/i);
    await user.clear(nomeInput);
    await user.type(nomeInput, 'Fulano Silva');

    const salvarBtn = screen.getByRole('button', { name: /^salvar$/i });
    await user.click(salvarBtn);

    await waitFor(() => {
      expect(PerfilService.salvarNome).toHaveBeenCalledWith('Fulano Silva');
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Dados salvos.');
    });
  });

  it('erro 400 ao salvar nome marca aria-invalid="true" no campo Nome', async () => {
    const user = userEvent.setup();
    vi.mocked(PerfilService.salvarNome).mockRejectedValueOnce({
      response: {
        status: 400,
        data: { erro: 'campo_invalido', campo: 'nome', motivo: 'Nome deve ter pelo menos 2 caracteres' },
      },
    });

    render(<SecaoVoce perfilInicial={mockPerfilBase} />);

    const salvarBtn = screen.getByRole('button', { name: /^salvar$/i });
    await user.click(salvarBtn);

    await waitFor(() => {
      const nomeInput = screen.getByLabelText(/^nome$/i);
      expect(nomeInput).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
