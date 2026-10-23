import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import TermsPage from "./page";
import { TermsService, type AcceptedTermItem, type TermStatusItem } from "@/services/api";
import { useSearchParams } from "next/navigation";

// termos-vigentes-e-aceitos: a tela de termos mostra o que já foi aceito,
// com versão, data e link da versão aceita (spec itens 14–18).

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
  usePathname: vi.fn().mockReturnValue("/termos"),
}));

vi.mock("@/services/api", async () => {
  const real = await vi.importActual<typeof import("@/services/api")>("@/services/api");
  return { ...real, TermsService: { getStatus: vi.fn(), accept: vi.fn() } };
});

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock("@/lib/pkce", () => ({ logoutFromHostedUI: vi.fn() }));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: vi.fn(() => ({
    activeTenantId: "tenant-123",
    activeTenantName: "Unum Test",
    availableTenants: [{ id: "tenant-123", nome_negocio: "Unum Test" }],
    isMultiTenant: false,
    switchTenant: vi.fn(),
    isLoadingTenants: false,
  })),
}));

const contratoAceito: AcceptedTermItem = {
  type: "contratacao_servico",
  term_id: "term-contrato",
  term_name: "Termo de Contratação",
  accepted_version: 3,
  // 01:00 UTC do dia 4 ainda é dia 3 em Brasília: prova o fuso.
  accepted_at: "2026-10-04T01:00:00Z",
  document_url: "https://unumpeople.com.br/termos/term-contrato/v3",
};
const usoAceito: AcceptedTermItem = {
  type: "termos_uso",
  term_id: "term-uso",
  term_name: "Termos de Uso",
  accepted_version: 2,
  accepted_at: "2026-10-23T12:00:00Z",
  document_url: "https://unumpeople.com.br/termos/term-uso/v2",
};
const politicaPendente: TermStatusItem = {
  type: "politica_privacidade",
  term_id: "term-priv",
  term_name: "Política de Privacidade",
  required_version: 5,
  can_accept: true,
  document_url: "https://unumpeople.com.br/termos/term-priv/v5",
};

async function abrir(pending: TermStatusItem[], accepted: AcceptedTermItem[]) {
  vi.mocked(TermsService.getStatus).mockResolvedValue({ pending, accepted });
  render(<TermsPage />);
  await waitFor(() => expect(screen.queryByText(/carregando termos/i)).not.toBeInTheDocument());
}

describe("Termos aceitos na tela de termos", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSearchParams).mockReturnValue({ get: vi.fn().mockReturnValue(null) } as never);
  });

  // T10
  it("tudo aceito: 'Tudo em dia!' e a lista de aceitos com versão, data e link da versão aceita", async () => {
    await abrir([], [contratoAceito, usoAceito]);

    expect(screen.getByText(/tudo em dia/i)).toBeInTheDocument();
    const regiao = screen.getByRole("region", { name: "Termos aceitos" });

    for (const [item, data] of [
      [contratoAceito, "03/10/2026"],
      [usoAceito, "23/10/2026"],
    ] as const) {
      expect(within(regiao).getByText(item.term_name)).toBeInTheDocument();
      expect(within(regiao).getByText(`Versão ${item.accepted_version}`)).toBeInTheDocument();
      expect(within(regiao).getByText(`Aceito em ${data}`)).toBeInTheDocument();
      const link = within(regiao).getByRole("link", { name: `Visualizar ${item.term_name}` });
      expect(link).toHaveAttribute("href", item.document_url);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    }
  });

  // T11
  it("com pendente: o pendente vem antes dos aceitos; ao aceitar, ele passa para os aceitos com a data de hoje", async () => {
    vi.mocked(TermsService.accept).mockResolvedValue(undefined);
    // "Hoje" às 02:00 UTC do dia 24 é dia 23 em Brasília.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T02:00:00Z"));
    await abrir([politicaPendente], [usoAceito]);

    const pendente = screen.getByRole("heading", { name: "Política de Privacidade" });
    const regiao = screen.getByRole("region", { name: "Termos aceitos" });
    expect(pendente.compareDocumentPosition(regiao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(regiao).queryByText("Política de Privacidade")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /aceitar e continuar/i }));

    const hoje = "23/10/2026";
    await waitFor(() => {
      const aceitos = screen.getByRole("region", { name: "Termos aceitos" });
      const politica = within(aceitos)
        .getAllByRole("listitem")
        .find((li) => within(li).queryByText("Política de Privacidade"));
      expect(politica).toBeDefined();
      expect(within(politica!).getByText("Versão 5")).toBeInTheDocument();
      expect(within(politica!).getByText(`Aceito em ${hoje}`)).toBeInTheDocument();
      expect(within(politica!).getByRole("link", { name: "Visualizar Política de Privacidade" })).toHaveAttribute(
        "href",
        politicaPendente.document_url,
      );
    });
    expect(screen.getByText(/tudo em dia/i)).toBeInTheDocument();
    expect(TermsService.getStatus).toHaveBeenCalledTimes(1);
  });

  // T12
  it("sem aceitos: a região de aceitos não aparece", async () => {
    await abrir([politicaPendente], []);

    expect(screen.queryByRole("region", { name: "Termos aceitos" })).not.toBeInTheDocument();
  });

  // Verifier: termo aceito cujo nome não carregou (a API manda term_name vazio).
  it("aceito sem nome mostra 'Documento sem título' e o link continua com nome acessível", async () => {
    await abrir([], [{ ...usoAceito, term_name: "" }]);

    const regiao = screen.getByRole("region", { name: "Termos aceitos" });
    expect(within(regiao).getByText("Documento sem título")).toBeInTheDocument();
    expect(within(regiao).getByRole("link", { name: "Visualizar Documento sem título" })).toHaveAttribute(
      "href",
      usoAceito.document_url,
    );
  });

  // Item 18: o erro de carga aparece num role="alert".
  it("falha ao carregar os termos aparece num alerta", async () => {
    vi.mocked(TermsService.getStatus).mockRejectedValue(new Error("rede"));
    render(<TermsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível carregar/i);
  });
});
