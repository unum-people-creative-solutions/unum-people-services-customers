import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import AppHeader from "./AppHeader";
import { usePathname } from "next/navigation";
import { logoutFromHostedUI } from "@/lib/pkce";

// Mocks
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/lib/pkce", () => ({
  logoutFromHostedUI: vi.fn(),
}));

describe("AppHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve renderizar o logo e o título do portal", () => {
    (usePathname as any).mockReturnValue("/produtos");
    render(<AppHeader />);

    expect(screen.getByText("Unum People")).toBeInTheDocument();
    expect(screen.getByText("Portal do Cliente")).toBeInTheDocument();
  });

  it("renderiza o link de Termos Legais e oculta Meus Produtos na rota /produtos", () => {
    (usePathname as any).mockReturnValue("/produtos");
    render(<AppHeader />);

    expect(screen.getByText("Termos Legais")).toBeInTheDocument();
    expect(screen.queryByText("Meus Produtos")).not.toBeInTheDocument();
  });

  it("renderiza o link de Meus Produtos e oculta Termos Legais na rota /termos", () => {
    (usePathname as any).mockReturnValue("/termos");
    render(<AppHeader />);

    expect(screen.getByText("Meus Produtos")).toBeInTheDocument();
    expect(screen.queryByText("Termos Legais")).not.toBeInTheDocument();
  });

  it("deve acionar logoutFromHostedUI ao clicar no botão Sair", () => {
    (usePathname as any).mockReturnValue("/produtos");
    render(<AppHeader />);

    const logoutButton = screen.getByRole("button", { name: /sair/i });
    logoutButton.click();

    expect(logoutFromHostedUI).toHaveBeenCalled();
  });
});
