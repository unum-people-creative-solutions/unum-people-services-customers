import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MeusDadosPage from './page';
import { NegocioService, PerfilService } from '@/services/meusDados';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/meus-dados'),
}));

vi.mock('@/services/meusDados', () => ({
  NegocioService: {
    ler: vi.fn(),
    salvar: vi.fn(),
  },
  PerfilService: {
    ler: vi.fn(),
    salvarNome: vi.fn(),
  },
}));

vi.mock('@/contexts/TenantContext', () => ({
  useTenant: vi.fn(() => ({
    activeTenantId: 'tenant-1',
    activeTenantName: '828 Imóveis',
    isLoadingTenants: false,
  })),
}));

vi.mock('@/contexts/CobrancaContext', () => ({
  useCobrancaOpcional: vi.fn(() => ({ resumo: null })),
  useCobranca: vi.fn(() => ({ resumo: null })),
}));

vi.mock('@/hooks/useMeusAcessos', () => ({
  useMeusAcessos: vi.fn(() => ({ podeGerirUsuarios: false, carregando: false, erro: false })),
}));

const mockNegocio = {
  nome_negocio: '828 Imóveis',
  documento: '12345678000190',
  email_cobranca: 'contato@828imoveis.com.br',
  celular: '41998785535',
  endereco: {
    cep: '82515000',
    logradouro: 'Av. Pref. Erasto Gaertner',
    numero: '2423',
    complemento: 'Sala 03',
    bairro: 'Bacacheri',
    cidade: 'Curitiba',
    uf: 'PR',
  },
  endereco_obrigatorio: true,
  endereco_completo: true,
  pode_editar: true,
};

const mockPerfil = {
  nome: 'Fulano da Silva',
  email: 'fulano@828imoveis.com.br',
  empresas: [{ id: 'tenant-1', nome_negocio: '828 Imóveis', papel_portal: 'Administrador' }],
};

describe('/meus-dados (TASK-FE-204, TASK-FE-301, T18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(NegocioService.ler).mockResolvedValue(mockNegocio);
    vi.mocked(PerfilService.ler).mockResolvedValue(mockPerfil);
  });

  it('monta as seções Você e Seu negócio com os dados da empresa e da pessoa', async () => {
    render(<MeusDadosPage />);

    await waitFor(() => {
      expect(NegocioService.ler).toHaveBeenCalledWith('tenant-1');
      expect(PerfilService.ler).toHaveBeenCalledTimes(1);

      expect(screen.getByRole('heading', { level: 2, name: 'Você' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Seu negócio' })).toBeInTheDocument();

      expect(screen.getByDisplayValue('Fulano da Silva')).toBeInTheDocument();
      expect(screen.getByDisplayValue('828 Imóveis')).toBeInTheDocument();
    });
  });

  it('T18 — seções separadas: salvar Você só chama PerfilService, e salvar Seu negócio só chama NegocioService', async () => {
    const user = userEvent.setup();
    vi.mocked(PerfilService.salvarNome).mockResolvedValue({
      ...mockPerfil,
      nome: 'Fulano Santos',
    });
    vi.mocked(NegocioService.salvar).mockResolvedValue({
      ...mockNegocio,
      nome_negocio: '828 Imóveis LTDA',
    });

    render(<MeusDadosPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Você' })).toBeInTheDocument();
    });

    // 1. Salvar na seção "Você"
    const inputNome = screen.getByLabelText(/^nome$/i);
    await user.clear(inputNome);
    await user.type(inputNome, 'Fulano Santos');

    const botaoSalvarVoce = screen.getByRole('button', { name: /^salvar$/i });
    await user.click(botaoSalvarVoce);

    await waitFor(() => {
      expect(PerfilService.salvarNome).toHaveBeenCalledWith('Fulano Santos');
      expect(NegocioService.salvar).not.toHaveBeenCalled();
    });

    // 2. Salvar na seção "Seu negócio"
    const inputNomeNegocio = screen.getByLabelText(/nome do negócio/i);
    await user.clear(inputNomeNegocio);
    await user.type(inputNomeNegocio, '828 Imóveis LTDA');

    const botaoSalvarNegocio = screen.getByRole('button', { name: /salvar alterações/i });
    await user.click(botaoSalvarNegocio);

    await waitFor(() => {
      expect(NegocioService.salvar).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ nome_negocio: '828 Imóveis LTDA' }),
      );
      // PerfilService continua tendo sido chamado apenas uma vez (do passo 1)
      expect(PerfilService.salvarNome).toHaveBeenCalledTimes(1);
    });
  });
});
