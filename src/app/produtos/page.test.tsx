import { render, screen, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ProductsPage from "./page";
import { TenantService, CancellationService, type PaginaDoConfigurador, type TenantResponse } from "@/services/api";
import { logoutFromHostedUI } from "@/lib/pkce";
import { useTenant } from "@/contexts/TenantContext";
import { useCobranca } from "@/contexts/CobrancaContext";
import type { ResumoDeCobranca } from "@/types/cobranca";
import {
  resumoBloqueado,
  resumoCancelada,
  resumoEmAtraso,
  resumoEmDia,
  resumoForaDoAr,
  resumoPausada,
} from "@/test/cobrancaFixtures";

// Mocks
vi.mock("@/services/api", () => ({
  TenantService: {
    getMe: vi.fn(),
  },
  // Administrador do Portal: acesso a todas as ferramentas (gestao-de-acesso-f4 RF-08).
  AcessosService: {
    get: vi.fn(() => Promise.resolve({
      tenant_id: "tenant-123",
      operador: false,
      ferramentas: [
        { id: "crm", nome: "CRM", contratada: true, papel: { id: "gestor", nome: "Gestor", sistema: true, implicito: true }, permissoes: ["crm.lead.ver"] },
        { id: "blog", nome: "Blog", contratada: true, papel: { id: "editor", nome: "Editor", sistema: true, implicito: true }, permissoes: ["blog.post.ver"] },
        { id: "lp", nome: "Páginas", contratada: true, papel: { id: "administrador", nome: "Administrador", sistema: true, implicito: true }, permissoes: ["lp.pagina.ver", "lp.rascunho.editar"] },
      ],
    })),
  },
  CancellationService: {
    getPreview: vi.fn().mockResolvedValue({ can_cancel: false, reason: "plan_livre", kind: "", effective_at: "", refund: null, refund_deadline: "", purge_days: 30, scheduled: null }),
    request: vi.fn(),
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

// cobranca-e-plano-do-cliente RF2-34: a página lê o resumo de cobrança do CobrancaProvider.
vi.mock("@/contexts/CobrancaContext", () => ({
  useCobranca: vi.fn(() => ({
    resumo: { situacao: "em_dia", fatura: null, ferramentas_bloqueadas: [], pode_gerir: true },
    carregando: false,
    erro: false,
    recarregar: vi.fn(),
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

    // Site personalizado
    const siteLink = screen.getByRole("link", { name: /visitar site/i });
    expect(siteLink).toHaveAttribute("href", "https://mybusiness.com.br");

    // CRM habilitado
    expect(screen.getByRole("link", { name: /acessar crm/i })).toBeInTheDocument();

    // Blog bloqueado
    expect(screen.getByText(/não incluso neste plano/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /acessar blog/i })).not.toBeInTheDocument();
  });

  it("sem site personalizado, o card do site não aparece (não existe mais o selo Em produção)", async () => {
    (TenantService.getMe as any).mockResolvedValue({
      site_url: "",
      enabled_services: ["blog"],
      plan_name: "Standard",
      status: "Ativo",
    });

    render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Site personalizado" })).not.toBeInTheDocument();
      expect(screen.queryByText(/em produção/i)).not.toBeInTheDocument();
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

    expect(screen.getAllByRole("heading", { name: /site personalizado/i })).toHaveLength(1);
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

  it("T18 — lista vazia e tenant legado com site_url vazio não mostram o card do site", async () => {
    (TenantService.getMe as any).mockResolvedValue({
      site_url: "",
      site_urls: [],
      enabled_services: [],
      plan_name: "Standard",
      status: "Ativo",
    });

    const { unmount } = render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Site personalizado" })).not.toBeInTheDocument();
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
      expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Site personalizado" })).not.toBeInTheDocument();
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

// O link Editar página (RF-5A-28 / CA-5A-21) passou a vir das páginas do
// configurador (GET /me/tenant "paginas"), não de site_urls: page.cards.test.tsx.

// T-602 (lp-nova-pagina RF-NP-602/603). As páginas seguem o JSON de
// paginaDoConfigurador da API (internal/handler/admin_handler.go).
describe("ProductsPage — página ainda não publicada (T-602)", () => {
  const aguardando: PaginaDoConfigurador = { slug: "nova", endereco: "https://nova.unumpages.app", publicada: false, aguarda_publicacao: true };
  // Resposta de antes da F1 da API: a chave não vem.
  const foraDoArSemAChave: PaginaDoConfigurador = { slug: "antiga", endereco: "https://antiga.unumpages.app", publicada: false };
  const foraDoAr: PaginaDoConfigurador = { slug: "pausada", endereco: "https://pausada.unumpages.app", publicada: false, aguarda_publicacao: false };
  const noAr: PaginaDoConfigurador = { slug: "loja", endereco: "https://loja.unumpages.app", publicada: true, aguarda_publicacao: false };

  async function abrirCom(paginas: PaginaDoConfigurador[]) {
    const dados: TenantResponse = { site_url: "", site_urls: [], enabled_services: [], plan_name: "Standard", status: "Ativo", paginas, paginas_indisponiveis: false };
    (TenantService.getMe as any).mockResolvedValue(dados);
    render(<ProductsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument();
    });
    return screen.getByRole("region", { name: "Configurador de páginas" });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publicada false com aguarda_publicacao true: Ainda não publicada, sem Página fora do ar; Editar continua", async () => {
    const configurador = await abrirCom([aguardando]);

    expect(within(configurador).getByText("Ainda não publicada")).toBeInTheDocument();
    expect(within(configurador).queryByText("Página fora do ar")).not.toBeInTheDocument();
    expect(within(configurador).queryByRole("link", { name: /Visitar/ })).not.toBeInTheDocument();
    expect(await within(configurador).findByRole("link", { name: "Editar página" })).toHaveAttribute("href", expect.stringContaining("/minha-conta/editar?slug=nova"));
  });

  it("publicada false sem a chave aguarda_publicacao: Página fora do ar; Editar continua", async () => {
    const configurador = await abrirCom([foraDoArSemAChave]);

    expect(within(configurador).getByText("Página fora do ar")).toBeInTheDocument();
    expect(within(configurador).queryByText("Ainda não publicada")).not.toBeInTheDocument();
    expect(within(configurador).queryByRole("link", { name: /Visitar/ })).not.toBeInTheDocument();
    expect(await within(configurador).findByRole("link", { name: "Editar página" })).toHaveAttribute("href", expect.stringContaining("/minha-conta/editar?slug=antiga"));
  });

  it("publicada false com aguarda_publicacao false: Página fora do ar", async () => {
    const configurador = await abrirCom([foraDoAr]);

    expect(within(configurador).getByText("Página fora do ar")).toBeInTheDocument();
    expect(within(configurador).queryByText("Ainda não publicada")).not.toBeInTheDocument();
  });

  it("publicada true: link Visitar, sem nenhum dos dois avisos; Editar continua", async () => {
    const configurador = await abrirCom([noAr]);

    expect(within(configurador).getByRole("link", { name: "Visitar página" })).toHaveAttribute("href", "https://loja.unumpages.app");
    expect(within(configurador).queryByText("Ainda não publicada")).not.toBeInTheDocument();
    expect(within(configurador).queryByText("Página fora do ar")).not.toBeInTheDocument();
    expect(await within(configurador).findByRole("link", { name: "Editar página" })).toHaveAttribute("href", expect.stringContaining("/minha-conta/editar?slug=loja"));
  });

  it("publicada true com aguarda_publicacao true: publicada vence, link Visitar e nenhum dos dois avisos", async () => {
    const configurador = await abrirCom([{ slug: "loja", endereco: "https://loja.unumpages.app", publicada: true, aguarda_publicacao: true }]);

    expect(within(configurador).getByRole("link", { name: "Visitar página" })).toHaveAttribute("href", "https://loja.unumpages.app");
    expect(within(configurador).queryByText("Ainda não publicada")).not.toBeInTheDocument();
    expect(within(configurador).queryByText("Página fora do ar")).not.toBeInTheDocument();
  });

  it("as três juntas: um aviso de cada, um Visitar e o Editar nas três, cada aviso na sua página", async () => {
    const configurador = await abrirCom([aguardando, foraDoArSemAChave, noAr]);

    expect(within(configurador).getAllByText("Ainda não publicada")).toHaveLength(1);
    expect(within(configurador).getAllByText("Página fora do ar")).toHaveLength(1);
    expect(within(configurador).getAllByRole("link", { name: /Visitar/ })).toHaveLength(1);
    const visitarLoja = within(configurador).getByRole("link", { name: "Visitar loja.unumpages.app" });
    expect(visitarLoja).toHaveAttribute("href", "https://loja.unumpages.app");

    const editarNova = await within(configurador).findByRole("link", { name: "Editar nova.unumpages.app" });
    const editarAntiga = within(configurador).getByRole("link", { name: "Editar antiga.unumpages.app" });
    const editarLoja = within(configurador).getByRole("link", { name: "Editar loja.unumpages.app" });

    // Cada página mostra o aviso (ou o Visitar) e, logo depois, o Editar dela:
    // a ordem no documento diz de qual página é cada aviso.
    const ordemEsperada: [string, HTMLElement][] = [
      ["Ainda não publicada", within(configurador).getByText("Ainda não publicada")],
      ["Editar nova", editarNova],
      ["Página fora do ar", within(configurador).getByText("Página fora do ar")],
      ["Editar antiga", editarAntiga],
      ["Visitar loja", visitarLoja],
      ["Editar loja", editarLoja],
    ];
    const naOrdemDoDocumento = [...ordemEsperada].sort(([, a], [, b]) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    expect(naOrdemDoDocumento.map(([nome]) => nome)).toEqual(ordemEsperada.map(([nome]) => nome));
  });
});

// spec: cobranca-e-plano-do-cliente RF2-34 (T43): "Status da Conta" pelo resumo de cobrança.
describe("ProductsPage — Status da Conta (RF2-34)", () => {
  function comCobranca(estado: { resumo: ResumoDeCobranca | null; carregando: boolean; erro: boolean }) {
    vi.mocked(useCobranca).mockReturnValue({ ...estado, recarregar: vi.fn() });
  }

  async function abrirCom(status: string) {
    (TenantService.getMe as any).mockResolvedValue({
      site_url: "",
      enabled_services: ["site", "crm", "blog"],
      plan_name: "Captação",
      status,
    } satisfies TenantResponse);
    render(<ProductsPage />);
    await waitFor(() => expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument());
  }

  function valorDoStatus() {
    return screen.getByText("Status da Conta").nextElementSibling as HTMLElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    (useTenant as any).mockReturnValue({
      activeTenantId: "tenant-123",
      availableTenants: [{ id: "tenant-123", nome_negocio: "Padaria Zé", enabled_services: ["site", "crm", "blog"] }],
      isMultiTenant: false,
      switchTenant: vi.fn(),
      isLoadingTenants: false,
    });
  });

  // Cada situação com o corpo que a API manda para ela (TECH-DESIGN T4 e §4.1).
  it.each([
    ["em_dia", "Em dia", resumoEmDia],
    ["em_atraso", "Fatura em atraso", resumoEmAtraso],
    ["bloqueado", "Acesso bloqueado", resumoBloqueado],
    ["fora_do_ar", "Fora do ar", resumoForaDoAr],
    ["pausada", "Pausada", resumoPausada],
    ["cancelada", "Cancelada", resumoCancelada],
  ] as const)("situacao %s mostra \"%s\", não o código cru do status", async (situacao, nome, resumo) => {
    expect(resumo.situacao).toBe(situacao);
    comCobranca({ resumo, carregando: false, erro: false });
    await abrirCom("INADIMPLENTE");
    expect(valorDoStatus().textContent).toBe(nome);
    expect(screen.queryByText("INADIMPLENTE")).not.toBeInTheDocument();
  });

  it.each([
    ["AGUARDANDO_ATIVACAO", "Aguardando o primeiro pagamento"],
    ["PENDENTE_ASAAS", "Em ativação"],
    ["SUSPENSO", "Suspensa"],
    ["EXCLUINDO", "Cancelada"],
    ["OUTRO_STATUS", "Fale com a gente"],
  ])("situacao outra com tenant.status %s mostra \"%s\"", async (status, nome) => {
    comCobranca({ resumo: { ...resumoEmDia, situacao: "outra" }, carregando: false, erro: false });
    await abrirCom(status);
    expect(valorDoStatus().textContent).toBe(nome);
  });

  it("resumo carregando: \"…\" com aria-busy=\"true\"", async () => {
    comCobranca({ resumo: null, carregando: true, erro: false });
    await abrirCom("ATIVO");
    expect(valorDoStatus().textContent).toBe("…");
    expect(valorDoStatus()).toHaveAttribute("aria-busy", "true");
  });

  it("resumo com erro: \"Não disponível\"", async () => {
    comCobranca({ resumo: null, carregando: false, erro: true });
    await abrirCom("ATIVO");
    expect(valorDoStatus().textContent).toBe("Não disponível");
    expect(valorDoStatus()).not.toHaveAttribute("aria-busy", "true");
  });
});

// spec: cobranca-e-plano-do-cliente RF3-02, T59 (BP-T §9.6): o cancelamento sai de /produtos.
describe("ProductsPage — Assinatura foi para Plano e faturas (T59)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTenant as any).mockReturnValue({
      activeTenantId: "tenant-123",
      availableTenants: [{ id: "tenant-123", nome_negocio: "Padaria Zé", enabled_services: ["site", "crm", "blog"] }],
      isMultiTenant: false,
      switchTenant: vi.fn(),
      isLoadingTenants: false,
    });
    (TenantService.getMe as any).mockResolvedValue({
      site_url: "https://padariaze.com.br",
      enabled_services: ["site", "crm", "blog"],
      plan_name: "Presença",
      status: "ATIVO",
    } satisfies TenantResponse);
  });

  it("não mostra o cancelamento (nem lê a prévia) e leva a /plano", async () => {
    render(<ProductsPage />);
    await waitFor(() => expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument());

    const linha = screen.getByText(
      (_conteudo, elemento) =>
        elemento?.tagName === "P" &&
        elemento.textContent === "Para ver faturas ou cancelar a assinatura, vá a Plano e faturas.",
    );
    expect(within(linha).getByRole("link", { name: "Plano e faturas" })).toHaveAttribute("href", "/plano");
    expect(screen.queryByRole("heading", { name: "Assinatura" })).not.toBeInTheDocument();
    expect(screen.queryByText("Carregando assinatura…")).not.toBeInTheDocument();
    expect(CancellationService.getPreview).not.toHaveBeenCalled();
  });
});
