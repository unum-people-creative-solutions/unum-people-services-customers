import { describe, it, expect, vi } from "vitest";

// O layout raiz carrega fonte e componentes; para ler só os metadados, basta simulá-los.
vi.mock("next/font/google", () => ({
  Poppins: () => ({ variable: "--font-poppins-mock", className: "poppins-mock-class" }),
}));
vi.mock("@/components/AuthGuard", () => ({ default: () => null }));
vi.mock("@/contexts/TenantContext", () => ({ TenantProvider: () => null }));

import { metadata } from "./layout";
import robots from "./robots";

describe("indexação do Portal do Cliente", () => {
  it("todas as páginas pedem para não indexar nem seguir links", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("o robots.txt bloqueia o portal inteiro, num único grupo para todos os robôs", () => {
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});
