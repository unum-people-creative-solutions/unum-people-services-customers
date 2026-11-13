import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MeusDadosPage from './page';
import { NegocioService } from '@/services/meusDados';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/meus-dados'),
}));

vi.mock('@/services/meusDados', () => ({
  NegocioService: {
    ler: vi.fn(),
    salvar: vi.fn(),
  },
  PerfilService: {
    ler: vi.fn().mockResolvedValue({
      nome: 'Usuário Teste',
      email: 'teste@example.com',
      empresas: [{ id: 'tenant-1', nome_negocio: '828 Imóveis', papel_portal: 'Administrador' }],
    }),
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

describe('/meus-dados (TASK-FE-204, RF-DNG-24, T19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('monta a seção Seu negócio com os dados da empresa ativa', async () => {
    vi.mocked(NegocioService.ler).mockResolvedValueOnce({
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
    });

    render(<MeusDadosPage />);

    await waitFor(() => {
      expect(NegocioService.ler).toHaveBeenCalledWith('tenant-1');
      expect(screen.getByRole('heading', { level: 2, name: 'Seu negócio' })).toBeInTheDocument();
      expect(screen.getByDisplayValue('828 Imóveis')).toBeInTheDocument();
      expect(screen.getByDisplayValue('41998785535')).toBeInTheDocument();
    });
  });
});
