import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SecaoNegocio from './SecaoNegocio';
import { NegocioService } from '@/services/meusDados';
import * as viaCepModule from '@/lib/viaCep';
import type { DadosDoNegocio } from '@/types/meusDados';

vi.mock('@/services/meusDados', () => ({
  NegocioService: {
    ler: vi.fn(),
    salvar: vi.fn(),
  },
}));

const mockDadosBase: DadosDoNegocio = {
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

describe('SecaoNegocio (TASK-FE-203, RF-DNG-25 a 29, T15, T16, T17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('T15 — Portal, Membro só vê (pode_editar: false)', () => {
    it('não exibe nenhum textbox nem botão Salvar alterações, e mostra o aviso para administradores', () => {
      const dadosLeitura: DadosDoNegocio = {
        ...mockDadosBase,
        pode_editar: false,
      };

      render(<SecaoNegocio dadosIniciais={dadosLeitura} tenantId="t1" />);

      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.queryByRole('button', { name: /salvar alterações/i })).toBeNull();
      expect(
        screen.getByText('Só administradores do Portal mudam estes dados.'),
      ).toBeInTheDocument();

      // Confere que os dados são exibidos como texto
      expect(screen.getByText('828 Imóveis')).toBeInTheDocument();
      expect(screen.getByText('12.345.678/0001-90')).toBeInTheDocument();
      expect(screen.getByText('contato@828imoveis.com.br')).toBeInTheDocument();

      // Notas de CPF/CNPJ e e-mail
      const notas = screen.getAllByText('Para trocar, fale com o suporte.');
      expect(notas.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('RF-DNG-27 — Alerta quando endereço pendente', () => {
    it('mostra alerta com role="alert" quando endereco_obrigatorio e nao endereco_completo', () => {
      const dadosPendentes: DadosDoNegocio = {
        ...mockDadosBase,
        endereco: null,
        endereco_obrigatorio: true,
        endereco_completo: false,
      };

      render(<SecaoNegocio dadosIniciais={dadosPendentes} tenantId="t1" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(
        'Falta o endereço. Sem ele, a nota fiscal das suas faturas não é emitida.',
      );
    });

    it('não mostra o alerta quando endereço completo', () => {
      render(<SecaoNegocio dadosIniciais={mockDadosBase} tenantId="t1" />);

      expect(
        screen.queryByText(/Falta o endereço\. Sem ele, a nota fiscal das suas faturas não é emitida\./i),
      ).toBeNull();
    });
  });

  describe('T16 — Portal, preenchimento de CEP via ViaCEP', () => {
    it('digitar 82515000 preenche Rua e Bairro e não toca em Número já digitado', async () => {
      const user = userEvent.setup();
      vi.spyOn(viaCepModule, 'buscarCep').mockResolvedValueOnce({
        logradouro: 'Rua Nova',
        bairro: 'Bairro Novo',
        cidade: 'Cidade Nova',
        uf: 'PR',
      });

      render(
        <SecaoNegocio
          dadosIniciais={{
            ...mockDadosBase,
            endereco: {
              cep: '',
              logradouro: '',
              numero: '999',
              complemento: 'Bloco B',
              bairro: '',
              cidade: '',
              uf: '',
            },
          }}
          tenantId="t1"
        />,
      );

      const cepInput = screen.getByLabelText(/^cep/i);
      const numeroInput = screen.getByLabelText(/^número/i);
      const ruaInput = screen.getByLabelText(/^rua/i);
      const bairroInput = screen.getByLabelText(/^bairro/i);

      expect(numeroInput).toHaveValue('999');

      await user.clear(cepInput);
      await user.type(cepInput, '82515000');

      await waitFor(() => {
        expect(ruaInput).toHaveValue('Rua Nova');
      });
      expect(bairroInput).toHaveValue('Bairro Novo');
      expect(numeroInput).toHaveValue('999');
    });

    it('quando o ViaCEP rejeita, não há alert de erro e os campos continuam editáveis', async () => {
      const user = userEvent.setup();
      vi.spyOn(viaCepModule, 'buscarCep').mockResolvedValueOnce(null);

      render(<SecaoNegocio dadosIniciais={mockDadosBase} tenantId="t1" />);

      const cepInput = screen.getByLabelText(/^cep/i);
      await user.clear(cepInput);
      await user.type(cepInput, '99999999');

      await waitFor(() => {
        expect(viaCepModule.buscarCep).toHaveBeenCalled();
      });

      expect(screen.queryByRole('alert')).toBeNull();
      const ruaInput = screen.getByLabelText(/^rua/i);
      expect(ruaInput).not.toBeDisabled();
    });
  });

  describe('T17 — Portal, respostas do salvamento', () => {
    it('sucesso: salva e mostra "Dados salvos." em role="status"', async () => {
      const user = userEvent.setup();
      vi.mocked(NegocioService.salvar).mockResolvedValueOnce({
        ...mockDadosBase,
        nome_negocio: '828 Imóveis Atualizado',
      });

      render(<SecaoNegocio dadosIniciais={mockDadosBase} tenantId="t1" />);

      const nomeInput = screen.getByLabelText(/nome do negócio/i);
      await user.clear(nomeInput);
      await user.type(nomeInput, '828 Imóveis Atualizado');

      const salvarBtn = screen.getByRole('button', { name: /salvar alterações/i });
      await user.click(salvarBtn);

      await waitFor(() => {
        const status = screen.getByRole('status');
        expect(status).toHaveTextContent('Dados salvos.');
      });
      expect(NegocioService.salvar).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({
          nome_negocio: '828 Imóveis Atualizado',
        }),
      );
    });

    it('erro 400 (campo): marca o campo com aria-invalid="true" e mostra o erro', async () => {
      const user = userEvent.setup();
      vi.mocked(NegocioService.salvar).mockRejectedValueOnce({
        tipo: 'campo',
        campo: 'nome_negocio',
        detalhe: 'Nome deve ter entre 2 e 80 caracteres',
      });

      render(<SecaoNegocio dadosIniciais={mockDadosBase} tenantId="t1" />);

      const salvarBtn = screen.getByRole('button', { name: /salvar alterações/i });
      await user.click(salvarBtn);

      await waitFor(() => {
        const nomeInput = screen.getByLabelText(/nome do negócio/i);
        expect(nomeInput).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByText('Nome deve ter entre 2 e 80 caracteres')).toBeInTheDocument();
      });
    });

    it('erro 422 (asaas): mostra "O Asaas recusou: {detalhe}. Confira o endereço." em role="alert" com texto literal', async () => {
      const user = userEvent.setup();
      vi.mocked(NegocioService.salvar).mockRejectedValueOnce({
        tipo: 'asaas',
        detalhe: '<b>CEP inválido</b>',
      });

      render(<SecaoNegocio dadosIniciais={mockDadosBase} tenantId="t1" />);

      const salvarBtn = screen.getByRole('button', { name: /salvar alterações/i });
      await user.click(salvarBtn);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(
          'O Asaas recusou: <b>CEP inválido</b>. Confira o endereço.',
        );
        // Confere que é texto literal e NÃO tag HTML <b>
        expect(alert.querySelector('b')).toBeNull();
      });
    });

    it('erro 503 (indisponivel): mostra "Não foi possível salvar agora. Tente de novo em alguns minutos." em role="alert"', async () => {
      const user = userEvent.setup();
      vi.mocked(NegocioService.salvar).mockRejectedValueOnce({
        tipo: 'indisponivel',
      });

      render(<SecaoNegocio dadosIniciais={mockDadosBase} tenantId="t1" />);

      const salvarBtn = screen.getByRole('button', { name: /salvar alterações/i });
      await user.click(salvarBtn);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(
          'Não foi possível salvar agora. Tente de novo em alguns minutos.',
        );
      });
    });
  });
});
