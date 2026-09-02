import { describe, it, expect } from "vitest";
import { siteHostLabel } from "./siteHost";

describe("siteHostLabel", () => {
  it("extrai o host de URL absoluta http/https", () => {
    expect(siteHostLabel("https://outro.com.br")).toBe("outro.com.br");
    expect(siteHostLabel("http://alpha.example")).toBe("alpha.example");
  });

  it("não lança com valor legado sem esquema e devolve o valor cru", () => {
    expect(() => siteHostLabel("meusite.com.br")).not.toThrow();
    expect(siteHostLabel("meusite.com.br")).toBe("meusite.com.br");
  });
});
