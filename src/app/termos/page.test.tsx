import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import TermsPage from "./page";
import { TermsService } from "@/services/api";
import { useSearchParams } from "next/navigation";
import { logoutFromHostedUI } from "@/lib/pkce";

// Mocks
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
  usePathname: vi.fn().mockReturnValue("/termos"),
}));

vi.mock("@/services/api", () => ({
  TermsService: {
    getStatus: vi.fn(),
    accept: vi.fn(),
  },
}));

vi.mock("@/lib/pkce", () => ({
  logoutFromHostedUI: vi.fn(),
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: vi.fn(() => ({
    activeTenantId: "tenant-123",
    availableTenants: [{ id: "tenant-123", nome_negocio: "Unum Test" }],
    isMultiTenant: false,
    switchTenant: vi.fn(),
    isLoadingTenants: false,
  })),
}));

describe("TermsPage (TASK-FE-CUST-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useSearchParams as any).mockReturnValue({
      get: vi.fn().mockReturnValue(null),
    });
  });

  it("exibe spinner de carregamento inicialmente e depois carrega os termos", async () => {
    (TermsService.getStatus as any).mockResolvedValue({ pending: [] });

    render(<TermsPage />);

    expect(screen.getByText(/carregando termos/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/carregando termos/i)).not.toBeInTheDocument();
      expect(TermsService.getStatus).toHaveBeenCalledWith("tenant-123");
    });
  });

  it("exibe estado 'tudo em dia' e botão de produtos quando a lista de pendências está vazia", async () => {
    (TermsService.getStatus as any).mockResolvedValue({ pending: [] });

    render(<TermsPage />);

    await waitFor(() => {
      expect(screen.getByText(/tudo em dia/i)).toBeInTheDocument();
      expect(screen.getByText(/ir para meus produtos/i)).toBeInTheDocument();
      expect(TermsService.getStatus).toHaveBeenCalledWith("tenant-123");
    });
  });

  it("lista termos pendentes com link de leitura e botão de aceite", async () => {
    const mockPending = [
      {
        type: "contratacao_servico",
        term_id: "term-1",
        term_name: "Contrato Principal",
        required_version: 2,
        can_accept: true,
        document_url: "https://example.com/term-1.html",
      },
      {
        type: "termos_uso",
        term_id: "term-2",
        term_name: "Termos de Uso Gerais",
        required_version: 1,
        can_accept: true,
        document_url: "https://example.com/term-2.html",
      },
    ];
    (TermsService.getStatus as any).mockResolvedValue({ pending: mockPending });

    render(<TermsPage />);

    await waitFor(() => {
      expect(screen.getByText("Contrato Principal")).toBeInTheDocument();
      expect(screen.getByText("Termos de Uso Gerais")).toBeInTheDocument();
      expect(TermsService.getStatus).toHaveBeenCalledWith("tenant-123");
    });

    const links = screen.getAllByText(/visualizar termo/i);
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "https://example.com/term-1.html");

    const acceptButtons = screen.getAllByRole("button", { name: /aceitar e continuar/i });
    expect(acceptButtons).toHaveLength(2);
  });

  it("desabilita botão de aceite e mostra aviso quando can_accept=false (não-TenantAdmin no contrato)", async () => {
    const mockPending = [
      {
        type: "contratacao_servico",
        term_id: "term-1",
        term_name: "Contrato de Serviço",
        required_version: 3,
        can_accept: false,
        document_url: "https://example.com/term-1.html",
      },
    ];
    (TermsService.getStatus as any).mockResolvedValue({ pending: mockPending });

    render(<TermsPage />);

    await waitFor(() => {
      expect(screen.getByText("Contrato de Serviço")).toBeInTheDocument();
      expect(screen.getByText(/somente o administrador da conta pode aceitar este termo/i)).toBeInTheDocument();
      expect(TermsService.getStatus).toHaveBeenCalledWith("tenant-123");
    });

    const acceptButton = screen.getByRole("button", { name: /aceitar e continuar/i });
    expect(acceptButton).toBeDisabled();
  });

  it("aceita um termo pendente e transiciona seu estado para somente leitura", async () => {
    const mockPending = [
      {
        type: "termos_uso",
        term_id: "term-1",
        term_name: "Termos de Uso v1",
        required_version: 1,
        can_accept: true,
        document_url: "https://example.com/term-1.html",
      },
    ];
    (TermsService.getStatus as any).mockResolvedValue({ pending: mockPending });
    (TermsService.accept as any).mockResolvedValue(undefined);

    render(<TermsPage />);

    await waitFor(() => {
      expect(screen.getByText("Termos de Uso v1")).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole("button", { name: /aceitar e continuar/i });
    acceptButton.click();

    await waitFor(() => {
      expect(TermsService.accept).toHaveBeenCalledWith("termos_uso", 1, "tenant-123");
      expect(screen.getByText(/aceito em/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /aceitar e continuar/i })).not.toBeInTheDocument();
    });
  });

  it("exibe aviso de conflito de versão (409) na tela se o aceite falhar devido a termo atualizado", async () => {
    const mockPending = [
      {
        type: "termos_uso",
        term_id: "term-1",
        term_name: "Termos de Uso v1",
        required_version: 1,
        can_accept: true,
        document_url: "https://example.com/term-1.html",
      },
    ];
    (TermsService.getStatus as any).mockResolvedValue({ pending: mockPending });
    const err409 = {
      response: {
        status: 409,
      },
    };
    (TermsService.accept as any).mockRejectedValue(err409);

    render(<TermsPage />);

    await waitFor(() => {
      expect(screen.getByText("Termos de Uso v1")).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole("button", { name: /aceitar e continuar/i });
    acceptButton.click();

    await waitFor(() => {
      expect(screen.getByText(/conflito de versão/i)).toBeInTheDocument();
      expect(TermsService.accept).toHaveBeenCalledWith("termos_uso", 1, "tenant-123");
    });
  });

  it("exibe mensagem de erro na tela se a busca inicial de termos falhar", async () => {
    (TermsService.getStatus as any).mockRejectedValue(new Error("Erro de rede"));

    render(<TermsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível carregar a lista de termos/i)).toBeInTheDocument();
      expect(TermsService.getStatus).toHaveBeenCalledWith("tenant-123");
    });
  });

  it("exibe erro genérico ou mensagem do backend se o aceite falhar por motivo não-409", async () => {
    const mockPending = [
      {
        type: "termos_uso",
        term_id: "term-1",
        term_name: "Termos de Uso v1",
        required_version: 1,
        can_accept: true,
        document_url: "https://example.com/term-1.html",
      },
    ];
    (TermsService.getStatus as any).mockResolvedValue({ pending: mockPending });
    
    const err500 = {
      response: {
        status: 500,
        data: { error: "Erro interno do servidor" }
      }
    };
    (TermsService.accept as any).mockRejectedValue(err500);

    render(<TermsPage />);

    await waitFor(() => {
      expect(screen.getByText("Termos de Uso v1")).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole("button", { name: /aceitar e continuar/i });
    acceptButton.click();

    await waitFor(() => {
      expect(screen.getByText("Erro interno do servidor")).toBeInTheDocument();
      expect(TermsService.accept).toHaveBeenCalledWith("termos_uso", 1, "tenant-123");
    });
  });

  it("exibe erro genérico de fallback se o aceite falhar sem resposta do servidor", async () => {
    const mockPending = [
      {
        type: "termos_uso",
        term_id: "term-1",
        term_name: "Termos de Uso v1",
        required_version: 1,
        can_accept: true,
        document_url: "https://example.com/term-1.html",
      },
    ];
    (TermsService.getStatus as any).mockResolvedValue({ pending: mockPending });
    (TermsService.accept as any).mockRejectedValue(new Error("Network Error"));

    render(<TermsPage />);

    await waitFor(() => {
      expect(screen.getByText("Termos de Uso v1")).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole("button", { name: /aceitar e continuar/i });
    acceptButton.click();

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível aceitar o termo/i)).toBeInTheDocument();
      expect(TermsService.accept).toHaveBeenCalledWith("termos_uso", 1, "tenant-123");
    });
  });

  it("permite fazer logout clicando no botão Sair", async () => {
    (TermsService.getStatus as any).mockResolvedValue({ pending: [] });

    render(<TermsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sair/i })).toBeInTheDocument();
    });

    screen.getByRole("button", { name: /sair/i }).click();
    expect(logoutFromHostedUI).toHaveBeenCalled();
  });

  describe("Redirecionamento com return_to", () => {
    let originalLocation: any;

    beforeEach(() => {
      originalLocation = window.location;
      delete (window as any).location;
      window.location = { href: "" } as any;
    });

    afterEach(() => {
      (window as any).location = originalLocation;
    });

    it("redireciona imediatamente para return_to se a lista de pendências estiver vazia", async () => {
      (TermsService.getStatus as any).mockResolvedValue({ pending: [] });
      (useSearchParams as any).mockReturnValue({
        get: vi.fn().mockImplementation((key) => {
          if (key === "return_to") return "https://crm.unumpeople.com.br/kanban";
          return null;
        }),
      });

      render(<TermsPage />);

      await waitFor(() => {
        expect(window.location.href).toBe("https://crm.unumpeople.com.br/kanban");
        expect(TermsService.getStatus).toHaveBeenCalledWith("tenant-123");
      });
    });

    it("redireciona para return_to após aceitar o último termo pendente", async () => {
      const mockPending = [
        {
          type: "termos_uso",
          term_id: "term-1",
          term_name: "Termos de Uso v1",
          required_version: 1,
          can_accept: true,
          document_url: "https://example.com/term-1.html",
        },
      ];
      (TermsService.getStatus as any).mockResolvedValue({ pending: mockPending });
      (TermsService.accept as any).mockResolvedValue(undefined);
      (useSearchParams as any).mockReturnValue({
        get: vi.fn().mockImplementation((key) => {
          if (key === "return_to") return "https://crm.unumpeople.com.br/kanban";
          return null;
        }),
      });

      render(<TermsPage />);

      await waitFor(() => {
        expect(screen.getByText("Termos de Uso v1")).toBeInTheDocument();
      });

      const acceptButton = screen.getByRole("button", { name: /aceitar e continuar/i });
      acceptButton.click();

      await waitFor(() => {
        expect(window.location.href).toBe("https://crm.unumpeople.com.br/kanban");
        expect(TermsService.accept).toHaveBeenCalledWith("termos_uso", 1, "tenant-123");
      });
    });

    it("não redireciona se restarem outros termos pendentes, redirecionando apenas após aceitar todos", async () => {
      const mockPending = [
        {
          type: "termos_uso",
          term_id: "term-1",
          term_name: "Termos de Uso v1",
          required_version: 1,
          can_accept: true,
          document_url: "https://example.com/term-1.html",
        },
        {
          type: "politica_privacidade",
          term_id: "term-2",
          term_name: "Política de Privacidade v1",
          required_version: 1,
          can_accept: true,
          document_url: "https://example.com/term-2.html",
        },
      ];
      (TermsService.getStatus as any).mockResolvedValue({ pending: mockPending });
      (TermsService.accept as any).mockResolvedValue(undefined);
      (useSearchParams as any).mockReturnValue({
        get: vi.fn().mockImplementation((key) => {
          if (key === "return_to") return "https://crm.unumpeople.com.br/kanban";
          return null;
        }),
      });

      render(<TermsPage />);

      await waitFor(() => {
        expect(screen.getByText("Termos de Uso v1")).toBeInTheDocument();
        expect(screen.getByText("Política de Privacidade v1")).toBeInTheDocument();
      });

      const acceptButtons = screen.getAllByRole("button", { name: /aceitar e continuar/i });
      expect(acceptButtons).toHaveLength(2);

      // Aceita o primeiro termo
      acceptButtons[0].click();

      // Aguarda o primeiro termo transicionar para aceito
      await waitFor(() => {
        expect(screen.getByText(/aceito em/i)).toBeInTheDocument();
      });

      // O redirecionamento NÃO deve ter ocorrido ainda porque o segundo termo continua pendente
      expect(window.location.href).toBe("");

      // Aceita o segundo termo
      const secondAcceptButton = screen.getByRole("button", { name: /aceitar e continuar/i });
      secondAcceptButton.click();

      // Agora que todos estão aceitos, deve redirecionar
      await waitFor(() => {
        expect(window.location.href).toBe("https://crm.unumpeople.com.br/kanban");
        expect(TermsService.accept).toHaveBeenNthCalledWith(1, "termos_uso", 1, "tenant-123");
        expect(TermsService.accept).toHaveBeenNthCalledWith(2, "politica_privacidade", 1, "tenant-123");
      });
    });
  });
});
