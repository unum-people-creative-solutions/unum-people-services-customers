import { render } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import Home from "./page";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("Home Page", () => {
  it("redireciona para /produtos ao acessar a rota raiz", () => {
    render(<Home />);
    expect(redirect).toHaveBeenCalledWith("/produtos");
  });

  it("outra query, sem return_to, também vai para /produtos", () => {
    render(<Home searchParams={{ tenant_id: "t-2", utm_source: "ads" }} />);
    expect(redirect).toHaveBeenLastCalledWith("/produtos");
  });

  it("preserva return_to e tenant_id ao redirecionar para /termos", () => {
    render(
      <Home
        searchParams={{
          return_to: "https://crm.unumpeople.com.br/dashboard?a=1&b=2",
          tenant_id: "t-2",
        }}
      />
    );
    const target = vi.mocked(redirect).mock.calls.at(-1)![0];
    const url = new URL(target, "http://localhost");
    expect(url.pathname).toBe("/termos");
    expect(url.searchParams.get("tenant_id")).toBe("t-2");
    expect(url.searchParams.get("return_to")).toBe("https://crm.unumpeople.com.br/dashboard?a=1&b=2");
  });
});
