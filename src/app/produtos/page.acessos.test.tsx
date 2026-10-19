import { render, screen, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ProductsPage from "./page";
import { AcessosService, TenantService, type MeusAcessos } from "@/services/api";

// spec: gestao-de-acesso-f4-aplicacao RF-08, CA-05 (Portal, Meus Produtos).

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
  useTenant: vi.fn(() => ({
    activeTenantId: "tenant-123",
    availableTenants: [{ id: "tenant-123", nome_negocio: "Unum Test" }],
    isMultiTenant: false,
    switchTenant: vi.fn(),
    isLoadingTenants: false,
  })),
}));

type Papeis = { crm: string[]; blog: string[]; lp: string[] };

function acessos({ crm, blog, lp }: Papeis): MeusAcessos {
  const ferramenta = (id: string, nome: string, permissoes: string[]) => ({
    id,
    nome,
    contratada: true,
    papel: permissoes.length ? { id: "p-x", nome: "Papel", sistema: false, implicito: false } : { id: "sem_acesso", nome: "Sem acesso", sistema: true, implicito: false },
    permissoes,
  });
  return {
    tenant_id: "tenant-123",
    operador: false,
    ferramentas: [
      ferramenta("portal", "Portal do Cliente", ["portal.empresa.ver"]),
      ferramenta("crm", "CRM", crm),
      ferramenta("blog", "Blog", blog),
      ferramenta("lp", "Páginas", lp),
    ],
  };
}

const TODAS: Papeis = {
  crm: ["crm.lead.ver", "crm.lead.criar", "crm.lead.editar", "crm.lead.excluir", "crm.integracoes.gerir"],
  blog: ["blog.post.ver", "blog.post.criar", "blog.post.editar_proprio", "blog.post.editar_qualquer", "blog.post.publicar", "blog.post.excluir", "blog.midia.enviar"],
  lp: ["lp.pagina.ver", "lp.rascunho.editar", "lp.pagina.publicar", "lp.dominio.gerir"],
};

// Cada cartão é uma região nomeada pelo título da ferramenta.
function cardDe(titulo: string) {
  return screen.getByRole("region", { name: titulo });
}

describe("Meus Produtos segue o papel de cada ferramenta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(TenantService.getMe).mockResolvedValue({
      site_url: "",
      site_urls: ["https://oficina.unumpeople.app"],
      enabled_services: ["crm", "blog", "site"],
      plan_name: "Completo",
      status: "Ativo",
    });
  });

  it("com acesso a tudo, cada cartão leva à ferramenta", async () => {
    vi.mocked(AcessosService.get).mockResolvedValue(acessos(TODAS));
    render(<ProductsPage />);
    expect(await screen.findByRole("link", { name: /Acessar CRM/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Acessar Blog/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Editar página/ })).toBeInTheDocument();
    expect(screen.queryByText("Sem acesso nesta empresa")).not.toBeInTheDocument();
    expect(AcessosService.get).toHaveBeenCalledWith("tenant-123");
  });

  it("Sem acesso no CRM: o cartão diz isso no lugar de Acessar; o Blog continua", async () => {
    vi.mocked(AcessosService.get).mockResolvedValue(acessos({ ...TODAS, crm: [] }));
    render(<ProductsPage />);
    expect(await screen.findByRole("link", { name: /Acessar Blog/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Acessar CRM/ })).not.toBeInTheDocument();
    expect(within(cardDe("CRM Unum")).getByText("Sem acesso nesta empresa")).toBeInTheDocument();
  });

  it("Sem acesso no Blog: o cartão diz isso no lugar de Acessar", async () => {
    vi.mocked(AcessosService.get).mockResolvedValue(acessos({ ...TODAS, blog: [] }));
    render(<ProductsPage />);
    expect(await screen.findByRole("link", { name: /Acessar CRM/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Acessar Blog/ })).not.toBeInTheDocument();
    expect(within(cardDe("Blog Admin")).getByText("Sem acesso nesta empresa")).toBeInTheDocument();
  });

  it("Páginas só com ver: o site continua visitável, sem Editar página", async () => {
    vi.mocked(AcessosService.get).mockResolvedValue(acessos({ ...TODAS, lp: ["lp.pagina.ver"] }));
    render(<ProductsPage />);
    expect(await screen.findByRole("link", { name: /Visitar Site/i })).toBeInTheDocument();
    await screen.findByRole("link", { name: /Acessar CRM/ });
    expect(screen.queryByRole("link", { name: /Editar página/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Sem acesso nesta empresa")).not.toBeInTheDocument();
  });

  it("Sem acesso às Páginas: o site continua visitável e o cartão diz Sem acesso", async () => {
    vi.mocked(AcessosService.get).mockResolvedValue(acessos({ ...TODAS, lp: [] }));
    render(<ProductsPage />);
    expect(await screen.findByRole("link", { name: /Visitar Site/i })).toBeInTheDocument();
    await screen.findByRole("link", { name: /Acessar CRM/ });
    expect(screen.queryByRole("link", { name: /Editar página/ })).not.toBeInTheDocument();
    expect(within(cardDe("Site Institucional")).getByText("Sem acesso nesta empresa")).toBeInTheDocument();
  });

  it("enquanto as permissões carregam, nenhum Acessar aparece", async () => {
    vi.mocked(AcessosService.get).mockReturnValue(new Promise(() => {}));
    render(<ProductsPage />);
    expect(await screen.findByRole("link", { name: /Visitar Site/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Acessar CRM/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Acessar Blog/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Editar página/ })).not.toBeInTheDocument();
  });

  it("se a leitura das permissões falha, avisa e esconde os Acessar", async () => {
    vi.mocked(AcessosService.get).mockRejectedValue(new Error("rede"));
    render(<ProductsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar suas permissões nesta empresa.");
    expect(screen.queryByRole("link", { name: /Acessar CRM/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Acessar Blog/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Editar página/ })).not.toBeInTheDocument();
  });
});
