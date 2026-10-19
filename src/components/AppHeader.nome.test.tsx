import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import AppHeader from "./AppHeader";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

// O cabeçalho mostra quem está logado: o nome do token do Cognito ou, sem ele, o e-mail.

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/produtos") }));
vi.mock("@/lib/pkce", () => ({ logoutFromHostedUI: vi.fn() }));
vi.mock("@/hooks/useMeusAcessos", () => ({
  useMeusAcessos: vi.fn(() => ({ podeGerirUsuarios: false, carregando: false, erro: false })),
}));
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: vi.fn(() => ({ activeTenantId: "tenant-1", availableTenants: [], isMultiTenant: false, switchTenant: vi.fn(), isLoadingTenants: false })),
}));

// id_token sem assinatura: só as claims importam aqui.
function token(claims: Record<string, unknown>) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.x`;
}

describe("AppHeader: quem está logado", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/produtos");
  });

  it("mostra o nome do token, com o e-mail no title", () => {
    useAuthStore.setState({ session: { email: "ana@clinica.com", token: token({ email: "ana@clinica.com", name: "Ana Souza" }) }, isAuthenticated: true });
    render(<AppHeader />);
    const quem = screen.getByText("Ana Souza");
    expect(quem).toHaveAttribute("title", "ana@clinica.com");
  });

  it("sem nome no token, mostra o e-mail", () => {
    useAuthStore.setState({ session: { email: "ana@clinica.com", token: token({ email: "ana@clinica.com" }) }, isAuthenticated: true });
    render(<AppHeader />);
    expect(screen.getByText("ana@clinica.com")).toBeInTheDocument();
  });

  it("nome em branco também cai no e-mail", () => {
    useAuthStore.setState({ session: { email: "ana@clinica.com", token: token({ email: "ana@clinica.com", name: "   " }) }, isAuthenticated: true });
    render(<AppHeader />);
    expect(screen.getByText("ana@clinica.com")).toBeInTheDocument();
  });

  it("token ilegível não derruba o cabeçalho: mostra o e-mail", () => {
    useAuthStore.setState({ session: { email: "ana@clinica.com", token: "nao-e-jwt" }, isAuthenticated: true });
    render(<AppHeader />);
    expect(screen.getByText("ana@clinica.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sair/ })).toBeInTheDocument();
  });

  it("sem sessão, não mostra ninguém", () => {
    useAuthStore.setState({ session: null, isAuthenticated: false });
    render(<AppHeader />);
    expect(screen.queryByText("ana@clinica.com")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sair/ })).toBeInTheDocument();
  });
});
