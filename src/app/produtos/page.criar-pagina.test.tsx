import { render, screen, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ProductsPage from "./page";
import { TenantService, AcessosService, TermsService, type TenantResponse } from "@/services/api";

// spec: portal-produtos-e-criar-pagina RF-PP-04 e RF-PP-05 (T04, T05).

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

function acessos(permissoesLp: string[], lpContratada = true) {
  return {
    tenant_id: "t1",
    operador: false,
    ferramentas: lpContratada
      ? [{ id: "lp", nome: "Páginas", contratada: true, papel: { id: "editor", nome: "Editor", sistema: true, implicito: false }, permissoes: permissoesLp }]
      : [{ id: "lp", nome: "Páginas", contratada: false, papel: null, permissoes: [] }],
  };
}

function tenant(parcial: Partial<TenantResponse>): TenantResponse {
  return { site_url: "", site_urls: [], enabled_services: ["site"], plan_name: "Plano", status: "ATIVO", paginas: [], paginas_indisponiveis: false, ...parcial };
}

const PAPEL_DONO = ["lp.pagina.ver", "lp.rascunho.editar", "lp.pagina.criar"];

async function abrir(dados: TenantResponse, permissoesLp = PAPEL_DONO, lpContratada = true) {
  vi.mocked(TenantService.getMe).mockResolvedValue(dados);
  vi.mocked(AcessosService.get).mockResolvedValue(acessos(permissoesLp, lpContratada) as never);
  vi.mocked(TermsService.getStatus).mockResolvedValue({ pending: [], accepted: [] });
  render(<ProductsPage />);
  await waitFor(() => expect(screen.queryByText(/carregando seus produtos/i)).not.toBeInTheDocument());
  await waitFor(() => expect(AcessosService.get).toHaveBeenCalled());
}

const card = () => screen.getByRole("region", { name: "Configurador de páginas" });

describe("Meus Produtos: Criar página no cartão do configurador (RF-PP-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("lp contratada, sem páginas e com lp.pagina.criar: cartão com o link Criar página para a área logada", async () => {
    await abrir(tenant({}));

    const link = await within(card()).findByRole("link", { name: "Criar página" });
    expect(link).toHaveAttribute("href", "https://unumpeople.app/minha-conta");
    expect(within(card()).queryByRole("link", { name: /Editar/ })).not.toBeInTheDocument();
    expect(within(card()).queryByText("Sem acesso nesta empresa")).not.toBeInTheDocument();
  });

  it("o endereço do configurador vem de NEXT_PUBLIC_LP_BUILDER_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_LP_BUILDER_URL", "https://lp.exemplo");
    await abrir(tenant({}));

    expect(await within(card()).findByRole("link", { name: "Criar página" })).toHaveAttribute("href", "https://lp.exemplo/minha-conta");
  });

  it("Editor (lp.rascunho.editar, sem lp.pagina.criar): Sem acesso nesta empresa, sem Criar página (RF-PP-04a)", async () => {
    await abrir(tenant({}), ["lp.pagina.ver", "lp.rascunho.editar"]);

    expect(await within(card()).findByText("Sem acesso nesta empresa")).toBeInTheDocument();
    expect(within(card()).getAllByText("Sem acesso nesta empresa")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Criar página" })).not.toBeInTheDocument();
  });

  it("só lp.pagina.ver: o cartão diz Sem acesso nesta empresa, sem Criar página", async () => {
    await abrir(tenant({}), ["lp.pagina.ver"]);

    expect(await within(card()).findByText("Sem acesso nesta empresa")).toBeInTheDocument();
    expect(within(card()).getAllByText("Sem acesso nesta empresa")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Criar página" })).not.toBeInTheDocument();
  });

  it("sem nenhuma permissão de páginas: Sem acesso, uma vez só", async () => {
    await abrir(tenant({}), []);

    expect(await within(card()).findByText("Sem acesso nesta empresa")).toBeInTheDocument();
    expect(within(card()).getAllByText("Sem acesso nesta empresa")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Criar página" })).not.toBeInTheDocument();
  });

  it("lp não contratada: sem cartão do configurador", async () => {
    await abrir(tenant({}), [], false);

    expect(screen.queryByRole("region", { name: "Configurador de páginas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Criar página" })).not.toBeInTheDocument();
  });

  it("falha ao ler as páginas: o alerta de hoje, sem Criar página", async () => {
    await abrir(tenant({ paginas: [], paginas_indisponiveis: true }));

    expect(within(card()).getByRole("alert")).toHaveTextContent("Não foi possível carregar as páginas do configurador.");
    expect(screen.queryByRole("link", { name: "Criar página" })).not.toBeInTheDocument();
  });

  it("cartão sem página: descrição própria; com página: a frase de sempre (RF-PP-04b)", async () => {
    await abrir(tenant({}));
    expect(within(card()).getByText("Monte a página do seu negócio no configurador da Unum People.")).toBeInTheDocument();
    expect(within(card()).queryByText(/Suas páginas montadas/)).not.toBeInTheDocument();
  });

  it("cartão com página: mantém a descrição de hoje", async () => {
    await abrir(tenant({ paginas: [{ slug: "copinha", endereco: "https://copinha.unumpeople.app", publicada: true }] }));
    expect(within(card()).getByText("Suas páginas montadas no configurador da Unum People, prontas para captar contatos.")).toBeInTheDocument();
    expect(within(card()).queryByText(/Monte a página do seu negócio/)).not.toBeInTheDocument();
  });

  it("com página existente, não há Criar página", async () => {
    await abrir(tenant({ paginas: [{ slug: "copinha", endereco: "https://copinha.unumpeople.app", publicada: true }] }));

    expect(await within(card()).findByRole("link", { name: "Editar página" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Criar página" })).not.toBeInTheDocument();
  });
});

describe("Meus Produtos: página de conta que ainda não pagou (RF-PP-05)", () => {
  const pagina = { slug: "copinha", endereco: "https://copinha.unumpeople.app", publicada: false };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it.each(["AGUARDANDO_ATIVACAO", "PENDENTE_ASAAS"])("conta %s com página não publicada: Vai ao ar quando o pagamento for confirmado", async (status) => {
    await abrir(tenant({ status, paginas: [pagina] }));

    expect(within(card()).getByText("Vai ao ar quando o pagamento for confirmado")).toBeInTheDocument();
    expect(within(card()).queryByText("Página fora do ar")).not.toBeInTheDocument();
  });

  it("conta ATIVO com página fora do ar: Página fora do ar", async () => {
    await abrir(tenant({ status: "ATIVO", paginas: [pagina] }));

    expect(within(card()).getByText("Página fora do ar")).toBeInTheDocument();
    expect(within(card()).queryByText("Vai ao ar quando o pagamento for confirmado")).not.toBeInTheDocument();
  });

  it("aguarda_publicacao numa conta ativa: Ainda não publicada", async () => {
    await abrir(tenant({ status: "ATIVO", paginas: [{ ...pagina, aguarda_publicacao: true }] }));

    expect(within(card()).getByText("Ainda não publicada")).toBeInTheDocument();
  });

  it("conta aguardando com página publicada: segue com Visitar página", async () => {
    await abrir(tenant({ status: "AGUARDANDO_ATIVACAO", paginas: [{ ...pagina, publicada: true }] }));

    expect(within(card()).getByRole("link", { name: "Visitar página" })).toBeInTheDocument();
    expect(within(card()).queryByText("Vai ao ar quando o pagamento for confirmado")).not.toBeInTheDocument();
  });
});
