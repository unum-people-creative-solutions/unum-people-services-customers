import { describe, it, expect } from "vitest";
import { getSafeRedirect } from "./safeRedirect";

describe("getSafeRedirect", () => {
  it("aceita caminhos relativos válidos", () => {
    expect(getSafeRedirect("/produtos")).toBe("/produtos");
    expect(getSafeRedirect("/termos")).toBe("/termos");
    expect(getSafeRedirect("/")).toBe("/");
  });

  it("rejeita caminhos relativos malformados (open redirect por protocolo relativo //)", () => {
    expect(getSafeRedirect("//attacker.com")).toBe("/termos");
    expect(getSafeRedirect("//google.com/foo")).toBe("/termos");
  });

  it("aceita URLs absolutas com host unumpeople.com.br ou subdomínios", () => {
    expect(getSafeRedirect("https://unumpeople.com.br")).toBe("https://unumpeople.com.br");
    expect(getSafeRedirect("https://crm.unumpeople.com.br/kanban")).toBe("https://crm.unumpeople.com.br/kanban");
    expect(getSafeRedirect("http://blog-admin.unumpeople.com.br/posts")).toBe("http://blog-admin.unumpeople.com.br/posts");
  });

  it("rejeita hostnames maliciosos ou phishing contendo unumpeople.com.br como parte do host", () => {
    expect(getSafeRedirect("https://phishingunumpeople.com.br")).toBe("/termos");
    expect(getSafeRedirect("https://unumpeople.com.br.attacker.com")).toBe("/termos");
  });

  it("rejeita URLs absolutas de domínios terceiros", () => {
    expect(getSafeRedirect("https://phishing.example.com")).toBe("/termos");
    expect(getSafeRedirect("https://google.com")).toBe("/termos");
  });

  it("retorna o valor padrão para entradas vazias, nulas ou inválidas", () => {
    expect(getSafeRedirect(null)).toBe("/termos");
    expect(getSafeRedirect(undefined)).toBe("/termos");
    expect(getSafeRedirect("")).toBe("/termos");
    expect(getSafeRedirect("not-a-url")).toBe("/termos");
  });

  it("respeita o valor padrão customizado", () => {
    expect(getSafeRedirect("https://phishing.example.com", "/custom-default")).toBe("/custom-default");
  });
});
