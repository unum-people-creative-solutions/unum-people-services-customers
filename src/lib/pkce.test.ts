import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthorizeUrl,
  redirectToHostedUI,
  logoutFromHostedUI,
  PKCE_VERIFIER_STORAGE_KEY,
  AUTH_RETURN_TO_STORAGE_KEY,
} from "./pkce";

describe("pkce", () => {
  describe("generateCodeVerifier", () => {
    it("usa crypto.getRandomValues (CSPRNG), nunca Math.random", () => {
      const spy = vi.spyOn(crypto, "getRandomValues");
      generateCodeVerifier();
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it("gera um verifier em base64url (sem +, / ou =) com tamanho válido para PKCE (43-128 chars)", () => {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
    });

    it("gera verifiers diferentes a cada chamada", () => {
      const a = generateCodeVerifier();
      const b = generateCodeVerifier();
      expect(a).not.toBe(b);
    });
  });

  describe("generateCodeChallenge", () => {
    it("deriva o challenge via SHA-256 (RFC 7636) — valor determinístico para um verifier conhecido", async () => {
      // Vetor de teste do próprio RFC 7636 (Appendix B)
      const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    });

    it("nunca retorna o próprio verifier (challenge é derivado, não é o verifier)", async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).not.toBe(verifier);
    });
  });

  describe("buildAuthorizeUrl", () => {
    it("monta a URL com code_challenge e code_challenge_method=S256, sem o code_verifier", () => {
      const url = buildAuthorizeUrl({
        domain: "https://auth.unumpeople.com.br",
        clientId: "customers-client-id",
        redirectUri: "https://customer.unumpeople.com.br/auth/callback",
        codeChallenge: "challenge-abc",
      });

      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe("https://auth.unumpeople.com.br/oauth2/authorize");
      expect(parsed.searchParams.get("client_id")).toBe("customers-client-id");
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("redirect_uri")).toBe("https://customer.unumpeople.com.br/auth/callback");
      expect(parsed.searchParams.get("code_challenge")).toBe("challenge-abc");
      expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url).not.toMatch(/code_verifier/);
    });
  });

  describe("redirectToHostedUI", () => {
    beforeEach(() => {
      window.sessionStorage.clear();
      delete (window as any).location;
      window.location = { href: "", origin: "https://customer.unumpeople.com.br" } as any;
      process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN = "https://auth.unumpeople.com.br";
      process.env.NEXT_PUBLIC_COGNITO_CUSTOMERS_CLIENT_ID = "customers-client-id";
    });

    it("persiste verifier e rota de retorno em sessionStorage e redireciona via window.location.href (não router.push)", async () => {
      await redirectToHostedUI("/termos");

      const storedVerifier = window.sessionStorage.getItem(PKCE_VERIFIER_STORAGE_KEY);
      expect(storedVerifier).toBeTruthy();
      expect(window.sessionStorage.getItem(AUTH_RETURN_TO_STORAGE_KEY)).toBe("/termos");

      const url = new URL(window.location.href);
      expect(url.origin + url.pathname).toBe("https://auth.unumpeople.com.br/oauth2/authorize");
      expect(url.searchParams.get("client_id")).toBe("customers-client-id");
      expect(url.searchParams.get("redirect_uri")).toBe("https://customer.unumpeople.com.br/auth/callback");
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      // O verifier nunca aparece na URL — só o challenge derivado dele.
      expect(window.location.href).not.toMatch(storedVerifier!);
    });
  });

  describe("logoutFromHostedUI", () => {
    beforeEach(() => {
      delete (window as any).location;
      window.location = { href: "", origin: "https://customer.unumpeople.com.br" } as any;
      process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN = "https://auth.unumpeople.com.br";
      process.env.NEXT_PUBLIC_COGNITO_CUSTOMERS_CLIENT_ID = "customers-client-id";
    });

    it("redireciona pro endpoint /logout do Cognito (nunca /oauth2/authorize) com logout_uri válido", () => {
      logoutFromHostedUI();

      const url = new URL(window.location.href);
      expect(url.origin + url.pathname).toBe("https://auth.unumpeople.com.br/logout");
      expect(url.searchParams.get("client_id")).toBe("customers-client-id");
      expect(url.searchParams.get("logout_uri")).toBe("https://customer.unumpeople.com.br/");
    });

    it("um redirectToHostedUI disparado logo após logoutFromHostedUI nunca sobrescreve a navegação de logout", async () => {
      window.sessionStorage.clear();
      logoutFromHostedUI();
      const hrefAfterLogout = window.location.href;
      expect(hrefAfterLogout).toContain("/logout");

      await redirectToHostedUI("/produtos");

      expect(window.location.href).toBe(hrefAfterLogout);
    });
  });
});
