import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ProductsPage from "./page";
import { TenantService } from "@/services/api";
import { logoutFromHostedUI } from "@/lib/pkce";
import { useTenant } from "@/contexts/TenantContext";

// Mocks
vi.mock("@/services/api", () => ({
  TenantService: {
    getMe: vi.fn(),
  },
}));

vi.mock("@/lib/pkce", () => ({
  logoutFromHostedUI: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/produtos"),
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

describe("ProductsPage (TASK-FE-CUST-005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe spinner de carregamento inicialmente e depois carrega os dados", async () => {
    (TenantService.getMe as any).mockResolvedValue({
      site_url: "https://mysite.com",
      enabled_services: ["crm"],
      plan_name: "Premium",
      status: "Ativo",
    });

    render(<ProductsPage />);

    expect(screen.getByText(/carregando seus produtos/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument();
      expect(TenantService.getMe).toHaveBeenCalledWith("tenant-123");
    });
  });

  it("exibe mensagem de erro se a busca de dados do tenant falhar", async () => {
    (TenantService.getMe as any).mockRejectedValue(new Error("Erro de rede"));

    render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível carregar as informações da sua conta/i)).toBeInTheDocument();
      expect(TenantService.getMe).toHaveBeenCalledWith("tenant-123");
    });
  });

  it("renderiza o plano da conta, site_url e habilita serviços corretos", async () => {
    (TenantService.getMe as any).mockResolvedValue({
      site_url: "https://mybusiness.com.br",
      enabled_services: ["crm"],
      plan_name: "Gold Plan",
      status: "Ativo",
    });

    render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Plano Ativo: Gold Plan/i)).toBeInTheDocument();
      expect(TenantService.getMe).toHaveBeenCalledWith("tenant-123");
    });

    // Site Institucional
    const siteLink = screen.getByRole("link", { name: /visitar site/i });
    expect(siteLink).toHaveAttribute("href", "https://mybusiness.com.br");

    // CRM habilitado
    expect(screen.getByRole("link", { name: /acessar crm/i })).toBeInTheDocument();

    // Blog bloqueado
    expect(screen.getByText(/não incluso neste plano/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /acessar blog/i })).not.toBeInTheDocument();
  });

  it("exibe selo 'Em produção' se site_url for vazio", async () => {
    (TenantService.getMe as any).mockResolvedValue({
      site_url: "",
      enabled_services: ["blog"],
      plan_name: "Standard",
      status: "Ativo",
    });

    render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText(/em produção/i)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /visitar site/i })).not.toBeInTheDocument();
      expect(TenantService.getMe).toHaveBeenCalledWith("tenant-123");
    });

    // CRM bloqueado
    expect(screen.getByText(/não incluso neste plano/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /acessar crm/i })).not.toBeInTheDocument();

    // Blog habilitado
    expect(screen.getByRole("link", { name: /acessar blog/i })).toBeInTheDocument();
  });

  it("permite fazer logout clicando no botão Sair", async () => {
    (TenantService.getMe as any).mockResolvedValue({
      site_url: "",
      enabled_services: [],
      plan_name: "Standard",
      status: "Ativo",
    });

    render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sair/i })).toBeInTheDocument();
      expect(TenantService.getMe).toHaveBeenCalledWith("tenant-123");
    });

    screen.getByRole("button", { name: /sair/i }).click();
    expect(logoutFromHostedUI).toHaveBeenCalled();
  });

  it("T32 (Verifier Fase 3.5, gap 2) — refaz a busca com o novo tenant_id quando o tenant ativo muda (troca via switcher)", async () => {
    (TenantService.getMe as any).mockResolvedValue({
      site_url: "https://mysite.com",
      enabled_services: ["crm"],
      plan_name: "Premium",
      status: "Ativo",
    });

    (useTenant as any).mockReturnValue({
      activeTenantId: "tenant-A",
      availableTenants: [
        { id: "tenant-A", nome_negocio: "Empresa A" },
        { id: "tenant-B", nome_negocio: "Empresa B" },
      ],
      isMultiTenant: true,
      switchTenant: vi.fn(),
      isLoadingTenants: false,
    });

    const { rerender } = render(<ProductsPage />);

    await waitFor(() => {
      expect(TenantService.getMe).toHaveBeenCalledWith("tenant-A");
    });
    expect(TenantService.getMe).toHaveBeenCalledTimes(1);

    // Simula o usuário trocando de tenant no TenantSwitcher — o hook
    // useTenant() passa a retornar o novo activeTenantId.
    (useTenant as any).mockReturnValue({
      activeTenantId: "tenant-B",
      availableTenants: [
        { id: "tenant-A", nome_negocio: "Empresa A" },
        { id: "tenant-B", nome_negocio: "Empresa B" },
      ],
      isMultiTenant: true,
      switchTenant: vi.fn(),
      isLoadingTenants: false,
    });
    rerender(<ProductsPage />);

    await waitFor(() => {
      expect(TenantService.getMe).toHaveBeenCalledWith("tenant-B");
    });
    expect(TenantService.getMe).toHaveBeenCalledTimes(2);
  });
});
