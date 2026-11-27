import { render, screen, waitFor, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ProductsPage from "./page";
import { useTenant } from "@/contexts/TenantContext";
import { TenantService, AcessosService, TermsService, type TenantResponse, type TermsStatusResponse } from "@/services/api";

// spec: portal-produtos-e-criar-pagina RF-PP-03 (T03): o termo pendente vira aviso em
// Produtos; a leitura do status nunca bloqueia a tela nem mostra erro.

vi.mock("@/services/api", () => ({
  TenantService: { getMe: vi.fn() },
  AcessosService: { get: vi.fn() },
  TermsService: { getStatus: vi.fn() },
}));
vi.mock("@/lib/pkce", () => ({ logoutFromHostedUI: vi.fn() }));
vi.mock("@/services/planos", () => ({
  PlanosService: { listar: vi.fn().mockResolvedValue([]), mudar: vi.fn() },
}));
vi.mock("next/navigation", () => ({ usePathname: vi.fn().mockReturnValue("/produtos") }));
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: vi.fn(() => ({ activeTenantId: "t1", availableTenants: [], isMultiTenant: false, switchTenant: vi.fn(), isLoadingTenants: false })),
}));
vi.mock("@/contexts/CobrancaContext", () => ({
  useCobranca: vi.fn(() => ({
    resumo: { situacao: "em_dia", fatura: null, ferramentas_bloqueadas: [], pode_gerir: true },
    carregando: false,
    erro: false,
    recarregar: vi.fn(),
  })),
}));

const tenant: TenantResponse = {
  site_url: "", site_urls: [], enabled_services: ["site", "crm"], plan_name: "Plano", status: "ATIVO", paginas: [], paginas_indisponiveis: false,
};

function termos(pendentes: number): TermsStatusResponse {
  return {
    pending: Array.from({ length: pendentes }, (_, i) => ({
      type: `tipo-${i}`, term_id: `termo-${i}`, term_name: `Termo ${i}`, required_version: 2, can_accept: true, document_url: "https://exemplo/termo",
    })),
    accepted: [],
  };
}

async function abrir() {
  vi.mocked(TenantService.getMe).mockResolvedValue(tenant);
  vi.mocked(AcessosService.get).mockResolvedValue({ tenant_id: "t1", operador: false, ferramentas: [] });
  render(<ProductsPage />);
  await waitFor(() => expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument());
}

describe("Meus Produtos: aviso de termo pendente (RF-PP-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("com 1 termo pendente, mostra o aviso com o link Ver termos para /termos", async () => {
    vi.mocked(TermsService.getStatus).mockResolvedValue(termos(1));
    await abrir();

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent("Você tem um termo para aceitar.");
    expect(screen.getByRole("link", { name: "Ver termos" })).toHaveAttribute("href", "/termos");
    expect(TermsService.getStatus).toHaveBeenCalledWith("t1");
  });

  it("sem termo pendente, nada aparece", async () => {
    vi.mocked(TermsService.getStatus).mockResolvedValue(termos(0));
    await abrir();
    await waitFor(() => expect(TermsService.getStatus).toHaveBeenCalled());

    expect(screen.queryByText("Você tem um termo para aceitar.")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver termos" })).not.toBeInTheDocument();
  });

  it("se a leitura falha, não avisa, não mostra erro e o resto da tela aparece", async () => {
    vi.mocked(TermsService.getStatus).mockRejectedValue({ response: { status: 500, data: { error: "internal_error" } } });
    await abrir();
    await waitFor(() => expect(TermsService.getStatus).toHaveBeenCalled());

    expect(screen.queryByText("Você tem um termo para aceitar.")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // O banner de erro da tela não tem role="alert": procura pelo texto dele.
    expect(screen.queryByText(/não foi possível carregar/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Erro")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seus Serviços" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "CRM Unum" })).toBeInTheDocument();
  });

  // RNF-PP-01: a resposta de uma conta que já saiu de cena não pode mexer no aviso da conta ativa.
  describe("troca de conta", () => {
    const useTenantDe = (id: string) => ({ activeTenantId: id, availableTenants: [], isMultiTenant: true, switchTenant: vi.fn(), isLoadingTenants: false });
    const atrasada = <T,>() => {
      let resolver!: (v: T) => void;
      const promessa = new Promise<T>((resolve) => { resolver = resolve; });
      return { promessa, resolver };
    };

    beforeEach(() => {
      vi.mocked(TenantService.getMe).mockResolvedValue(tenant);
      vi.mocked(AcessosService.get).mockResolvedValue({ tenant_id: "t1", operador: false, ferramentas: [] });
    });

    it("a resposta atrasada da conta anterior não faz aparecer o aviso na conta nova", async () => {
      const antiga = atrasada<TermsStatusResponse>();
      vi.mocked(TermsService.getStatus).mockImplementation((id) => (id === "t1" ? antiga.promessa : Promise.resolve(termos(0))));
      vi.mocked(useTenant).mockReturnValue(useTenantDe("t1"));
      const { rerender } = render(<ProductsPage />);
      await waitFor(() => expect(TermsService.getStatus).toHaveBeenCalledWith("t1"));

      vi.mocked(useTenant).mockReturnValue(useTenantDe("t2"));
      rerender(<ProductsPage />);
      await waitFor(() => expect(TermsService.getStatus).toHaveBeenCalledWith("t2"));
      await waitFor(() => expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument());

      await act(async () => {
        antiga.resolver(termos(1));
      });

      expect(screen.queryByText("Você tem um termo para aceitar.")).not.toBeInTheDocument();
    });

    it("o aviso da conta anterior some ao trocar, mesmo com a leitura da conta nova ainda pendente", async () => {
      const nova = atrasada<TermsStatusResponse>();
      vi.mocked(TermsService.getStatus).mockImplementation((id) => (id === "t1" ? Promise.resolve(termos(1)) : nova.promessa));
      vi.mocked(useTenant).mockReturnValue(useTenantDe("t1"));
      const { rerender } = render(<ProductsPage />);
      expect(await screen.findByText("Você tem um termo para aceitar.")).toBeInTheDocument();

      vi.mocked(useTenant).mockReturnValue(useTenantDe("t2"));
      rerender(<ProductsPage />);
      await waitFor(() => expect(TermsService.getStatus).toHaveBeenCalledWith("t2"));
      await waitFor(() => expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument());

      expect(screen.getByRole("heading", { name: "Seus Serviços" })).toBeInTheDocument();
      expect(screen.queryByText("Você tem um termo para aceitar.")).not.toBeInTheDocument();
    });
  });
});
