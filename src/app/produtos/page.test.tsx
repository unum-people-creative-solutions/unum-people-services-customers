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

describe("ProductsPage — lista de sites (TASK-FE-CUST-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTenant as any).mockReturnValue({
      activeTenantId: "tenant-123",
      availableTenants: [{ id: "tenant-123", nome_negocio: "Unum Test" }],
      isMultiTenant: false,
      switchTenant: vi.fn(),
      isLoadingTenants: false,
    });
  });

  it("T17 — dois sites produzem dois links com nomes acessíveis distintos no mesmo card", async () => {
    (TenantService.getMe as any).mockResolvedValue({
      site_url: "https://alpha.example",
      site_urls: ["https://alpha.example", "https://beta.example"],
      enabled_services: [],
      plan_name: "Standard",
      status: "Ativo",
    });

    render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument();
    });

    const linkAlpha = screen.getByRole("link", { name: /alpha\.example/i });
    const linkBeta = screen.getByRole("link", { name: /beta\.example/i });

    expect(linkAlpha).toHaveAttribute("href", "https://alpha.example");
    expect(linkBeta).toHaveAttribute("href", "https://beta.example");
    expect(linkAlpha).toHaveAttribute("target", "_blank");
    expect(linkAlpha).toHaveAttribute("rel", "noopener noreferrer");
    expect(linkBeta).toHaveAttribute("target", "_blank");
    expect(linkBeta).toHaveAttribute("rel", "noopener noreferrer");
    expect(linkAlpha.getAttribute("href")).not.toBe(linkBeta.getAttribute("href"));

    expect(screen.getAllByRole("heading", { name: /site institucional/i })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /crm unum/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /blog admin/i })).toBeInTheDocument();
  });

  it("T18 — com exatamente um site em site_urls, o nome acessível continua casando com Visitar site", async () => {
    (TenantService.getMe as any).mockResolvedValue({
      site_url: "",
      site_urls: ["https://unico.example"],
      enabled_services: [],
      plan_name: "Standard",
      status: "Ativo",
    });

    render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument();
    });

    const siteLink = screen.getByRole("link", { name: /visitar site/i });
    expect(siteLink).toHaveAttribute("href", "https://unico.example");
    expect(siteLink).toHaveAttribute("target", "_blank");
    expect(siteLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getAllByRole("link", { name: /visitar site/i })).toHaveLength(1);
  });

  it("T18 — lista vazia e tenant legado com site_url vazio mostram o selo Em produção", async () => {
    (TenantService.getMe as any).mockResolvedValue({
      site_url: "",
      site_urls: [],
      enabled_services: [],
      plan_name: "Standard",
      status: "Ativo",
    });

    const { unmount } = render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText(/em produção/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: /visitar site/i })).not.toBeInTheDocument();

    unmount();

    (TenantService.getMe as any).mockResolvedValue({
      site_url: "",
      enabled_services: [],
      plan_name: "Standard",
      status: "Ativo",
    });

    render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText(/em produção/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: /visitar site/i })).not.toBeInTheDocument();
  });

  it("G2 — URL legado sem esquema não derruba a página: 2 links renderizam e href permanece o valor original", async () => {
    (TenantService.getMe as any).mockResolvedValue({
      site_url: "meusite.com.br",
      site_urls: ["meusite.com.br", "https://outro.com.br"],
      enabled_services: [],
      plan_name: "Standard",
      status: "Ativo",
    });

    render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument();
    });

    const links = screen.getAllByRole("link", { name: /visitar/i });
    expect(links).toHaveLength(2);

    const legacyLink = screen.getByRole("link", { name: /meusite\.com\.br/i });
    const otherLink = screen.getByRole("link", { name: /outro\.com\.br/i });

    expect(legacyLink).toHaveAttribute("href", "meusite.com.br");
    expect(otherLink).toHaveAttribute("href", "https://outro.com.br");
    expect(legacyLink).toHaveAttribute("target", "_blank");
    expect(legacyLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(otherLink).toHaveAttribute("target", "_blank");
    expect(otherLink).toHaveAttribute("rel", "noopener noreferrer");
  });
});

