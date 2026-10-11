import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useSearchParams } from "next/navigation";
import TermsPage from "./page";
import { TenantProvider } from "@/contexts/TenantContext";
import { TermsService, TenantService } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

// Integração TenantProvider (real) + TermsPage: o tenant_id da URL decide
// para qual tenant o aceite é enviado (CA-02).
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
  usePathname: vi.fn().mockReturnValue("/termos"),
}));

vi.mock("@/store/authStore", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  TermsService: { getStatus: vi.fn(), accept: vi.fn() },
  TenantService: { list: vi.fn(), getMe: vi.fn() },
}));

vi.mock("@/lib/pkce", () => ({
  logoutFromHostedUI: vi.fn(),
}));

const pendingContract = {
  type: "contratacao_servico",
  term_id: "term-1",
  term_name: "Contrato Principal",
  required_version: 2,
  can_accept: true,
  document_url: "https://example.com/term-1.html",
};

describe("Termos — tenant pedido pela URL até o aceite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    (useAuthStore as any).mockReturnValue({
      session: { email: "user@test.com", token: "mock-token" },
      logout: vi.fn(),
    });
    (TenantService.list as any).mockResolvedValue([
      { id: "t-1", nome_negocio: "Clínica Um" },
      { id: "t-2", nome_negocio: "Clínica Dois" },
    ]);
    (TermsService.getStatus as any).mockResolvedValue({ pending: [pendingContract] });
    (TermsService.accept as any).mockResolvedValue({});
  });

  const renderPage = (tenantId: string | null) => {
    (useSearchParams as any).mockReturnValue({
      get: (key: string) => (key === "tenant_id" ? tenantId : null),
    });
    return render(
      <TenantProvider>
        <TermsPage />
      </TenantProvider>
    );
  };

  it("com ?tenant_id=t-2 o aceite é enviado para t-2", async () => {
    const user = userEvent.setup();
    renderPage("t-2");

    await screen.findByText("Contrato Principal");
    await waitFor(() => expect(TermsService.getStatus).toHaveBeenLastCalledWith("t-2"));

    await user.click(screen.getByRole("button", { name: /aceitar e continuar/i }));

    await waitFor(() => expect(TermsService.accept).toHaveBeenCalledWith("contratacao_servico", 2, "t-2"));
  });

  it("com ?tenant_id=t-9 (fora da lista) o aceite segue a regra atual: primeiro tenant", async () => {
    const user = userEvent.setup();
    renderPage("t-9");

    await screen.findByText("Contrato Principal");

    await user.click(screen.getByRole("button", { name: /aceitar e continuar/i }));

    await waitFor(() => expect(TermsService.accept).toHaveBeenCalledWith("contratacao_servico", 2, "t-1"));
  });
});
