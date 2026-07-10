import { render } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import Home from "./page";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("Home Page", () => {
  it("redireciona para /termos ao acessar a rota raiz", () => {
    render(<Home />);
    expect(redirect).toHaveBeenCalledWith("/termos");
  });
});
