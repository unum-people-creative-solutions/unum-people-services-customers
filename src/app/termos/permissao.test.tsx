import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TermsPage from "./page";
import { TermsService } from "@/services/api";
import { useSearchParams } from "next/navigation";

// spec: gestao-de-acesso-f4-aplicacao "Requisitos — Telas": um 403 com permissao vindo da API
// aparece como "Você não tem permissão para fazer isso nesta empresa."

vi.mock("next/navigation", () => ({ useSearchParams: vi.fn(), usePathname: vi.fn().mockReturnValue("/termos") }));
vi.mock("@/services/api", async () => {
  const real = await vi.importActual<typeof import("@/services/api")>("@/services/api");
  return { ...real, TermsService: { getStatus: vi.fn(), accept: vi.fn() } };
});
vi.mock("@/lib/pkce", () => ({ logoutFromHostedUI: vi.fn(), redirectToHostedUI: vi.fn() }));
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: vi.fn(() => ({ activeTenantId: "tenant-123", availableTenants: [{ id: "tenant-123", nome_negocio: "Unum Test" }], isMultiTenant: false, switchTenant: vi.fn(), isLoadingTenants: false })),
}));

describe("Termos: recusa por permissão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSearchParams).mockReturnValue({ get: vi.fn().mockReturnValue(null) } as any);
  });

  it("403 com portal.contrato.aceitar mostra a mensagem de permissão, não o código da API", async () => {
    vi.mocked(TermsService.getStatus).mockResolvedValue({
      pending: [{ type: "contratacao_servico", term_id: "t-c", term_name: "Termo de Contratação", required_version: 2, can_accept: true, document_url: "https://example.com/t.html" }],
    });
    vi.mocked(TermsService.accept).mockRejectedValue({ response: { status: 403, data: { error: "forbidden", permissao: "portal.contrato.aceitar" } } });
    render(<TermsPage />);
    const aceitar = await screen.findByRole("button", { name: /aceitar e continuar/i });
    aceitar.click();
    await waitFor(() => expect(screen.getByText("Você não tem permissão para fazer isso nesta empresa.")).toBeInTheDocument());
    expect(screen.queryByText("forbidden")).not.toBeInTheDocument();
  });
});
