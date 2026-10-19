import { render, screen, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ProductsPage from "./page";
import { TenantService, AcessosService, type TenantResponse } from "@/services/api";

// "Configurador de páginas" é um card à parte do "Site personalizado", e o
// site personalizado só aparece para quem tem um (domínio próprio em site_urls).

vi.mock("@/services/api", () => ({
  TenantService: { getMe: vi.fn() },
  AcessosService: { get: vi.fn() },
  CancellationService: {
    getPreview: vi.fn().mockResolvedValue({ can_cancel: false, reason: "plan_livre", kind: "", effective_at: "", refund: null, refund_deadline: "", purge_days: 30, scheduled: null }),
    request: vi.fn(),
  },
}));
vi.mock("@/lib/pkce", () => ({ logoutFromHostedUI: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: vi.fn().mockReturnValue("/produtos") }));
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: vi.fn(() => ({ activeTenantId: "t1", availableTenants: [], isMultiTenant: false, switchTenant: vi.fn(), isLoadingTenants: false })),
}));

function acessosComLp(permissoes: string[]) {
  return {
    tenant_id: "t1",
    operador: false,
    ferramentas: [
      { id: "lp", nome: "Páginas", contratada: true, papel: { id: "editor", nome: "Editor", sistema: true, implicito: false }, permissoes },
    ],
  };
}

function tenant(parcial: Partial<TenantResponse>): TenantResponse {
  return { site_url: "", site_urls: [], enabled_services: ["site"], plan_name: "Plano", status: "ATIVO", paginas: [], paginas_indisponiveis: false, ...parcial };
}

async function abrir(dados: TenantResponse, permissoesLp = ["lp.pagina.ver", "lp.rascunho.editar"]) {
  vi.mocked(TenantService.getMe).mockResolvedValue(dados);
  vi.mocked(AcessosService.get).mockResolvedValue(acessosComLp(permissoesLp) as never);
  render(<ProductsPage />);
  await waitFor(() => expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument());
}

const card = (titulo: string) => screen.getByRole("region", { name: titulo });

describe("Meus Produtos: Configurador de páginas e Site personalizado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("cliente do configurador: card próprio com visitar e editar; sem card de site personalizado", async () => {
    await abrir(tenant({ paginas: [{ slug: "copinha", endereco: "https://copinha.unumpeople.app", publicada: true }] }));

    const configurador = card("Configurador de páginas");
    expect(within(configurador).getByRole("link", { name: "Visitar página" })).toHaveAttribute("href", "https://copinha.unumpeople.app");
    await waitFor(() =>
      expect(within(configurador).getByRole("link", { name: "Editar página" })).toHaveAttribute("href", "https://unumpeople.app/minha-conta/editar?slug=copinha"),
    );
    expect(screen.queryByRole("region", { name: "Site personalizado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Site Institucional" })).not.toBeInTheDocument();
  });

  it("cliente de site personalizado: card com o domínio próprio; sem card do configurador", async () => {
    await abrir(tenant({ site_urls: ["https://eliziarioadv.com.br"] }));

    const site = card("Site personalizado");
    expect(within(site).getByRole("link", { name: "Visitar site" })).toHaveAttribute("href", "https://eliziarioadv.com.br");
    expect(within(site).queryByRole("link", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Configurador de páginas" })).not.toBeInTheDocument();
  });

  it("sem site personalizado nem páginas, nenhum dos dois cards aparece", async () => {
    await abrir(tenant({ enabled_services: ["crm"] }));

    expect(screen.queryByRole("region", { name: "Site personalizado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Configurador de páginas" })).not.toBeInTheDocument();
    expect(screen.queryByText(/em produção/i)).not.toBeInTheDocument();
  });

  it("várias páginas: cada uma com nome acessível próprio; editar usa o slug de cada uma", async () => {
    vi.stubEnv("NEXT_PUBLIC_LP_BUILDER_URL", "https://lp.exemplo");
    await abrir(tenant({ paginas: [
      { slug: "loja", endereco: "https://loja.com.br", publicada: true },
      { slug: "promo", endereco: "https://promo.unumpeople.app", publicada: true },
    ] }));

    const configurador = card("Configurador de páginas");
    expect(within(configurador).getByRole("link", { name: "Visitar loja.com.br" })).toHaveAttribute("href", "https://loja.com.br");
    expect(within(configurador).getByRole("link", { name: "Visitar promo.unumpeople.app" })).toHaveAttribute("href", "https://promo.unumpeople.app");
    await waitFor(() =>
      expect(within(configurador).getByRole("link", { name: "Editar loja.com.br" })).toHaveAttribute("href", "https://lp.exemplo/minha-conta/editar?slug=loja"),
    );
    expect(within(configurador).getByRole("link", { name: "Editar promo.unumpeople.app" })).toHaveAttribute("href", "https://lp.exemplo/minha-conta/editar?slug=promo");
  });

  it("página fora do ar: sem Visitar, com o aviso; editar continua", async () => {
    await abrir(tenant({ paginas: [{ slug: "copinha", endereco: "https://copinha.unumpeople.app", publicada: false }] }));

    const configurador = card("Configurador de páginas");
    expect(within(configurador).queryByRole("link", { name: /Visitar/ })).not.toBeInTheDocument();
    expect(within(configurador).getByText("Página fora do ar")).toBeInTheDocument();
    await waitFor(() => expect(within(configurador).getByRole("link", { name: "Editar página" })).toBeInTheDocument());
  });

  it("sem lp.rascunho.editar: visita, mas não edita; sem lp.pagina.ver: diz Sem acesso", async () => {
    await abrir(tenant({ paginas: [{ slug: "copinha", endereco: "https://copinha.unumpeople.app", publicada: true }] }), ["lp.pagina.ver"]);
    let configurador = card("Configurador de páginas");
    await waitFor(() => expect(AcessosService.get).toHaveBeenCalled());
    expect(within(configurador).getByRole("link", { name: "Visitar página" })).toBeInTheDocument();
    expect(within(configurador).queryByRole("link", { name: /Editar/ })).not.toBeInTheDocument();

    vi.clearAllMocks();
    document.body.innerHTML = "";
    await abrir(tenant({ paginas: [{ slug: "copinha", endereco: "https://copinha.unumpeople.app", publicada: true }] }), []);
    configurador = card("Configurador de páginas");
    expect(await within(configurador).findByText("Sem acesso nesta empresa")).toBeInTheDocument();
    expect(within(configurador).queryByRole("link", { name: /Editar/ })).not.toBeInTheDocument();
  });

  it("falha ao ler as páginas: avisa em vez de sumir com o card", async () => {
    await abrir(tenant({ paginas: [], paginas_indisponiveis: true }));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar as páginas do configurador.");
  });

  it("o texto de boas-vindas fala dos seus sites, não do site institucional", async () => {
    await abrir(tenant({}));
    expect(screen.queryByText(/site institucional/i)).not.toBeInTheDocument();
    expect(screen.getByText(/status dos seus sites/i)).toBeInTheDocument();
  });
});
