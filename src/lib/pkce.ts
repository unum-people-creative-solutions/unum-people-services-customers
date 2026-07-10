function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

export function buildAuthorizeUrl(params: {
  domain: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
}): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${params.domain}/oauth2/authorize?${query.toString()}`;
}

export const PKCE_VERIFIER_STORAGE_KEY = "pkce_code_verifier";
export const AUTH_RETURN_TO_STORAGE_KEY = "auth_return_to";

export interface TokenResponse {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCodeForTokens(params: {
  domain: string;
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: params.clientId,
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });

  const response = await fetch(`${params.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Falha na troca de código por token (${response.status})`);
  }

  return response.json();
}

function getEnvConfig() {
  const domain = process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CUSTOMERS_CLIENT_ID;

  if (!domain) {
    throw new Error("[pkce] Variável de ambiente não configurada: NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN");
  }
  if (!clientId) {
    throw new Error("[pkce] Variável de ambiente não configurada: NEXT_PUBLIC_COGNITO_CUSTOMERS_CLIENT_ID");
  }

  return { domain, clientId };
}

const LOGOUT_IN_PROGRESS_KEY = "logout_in_progress_at";
const LOGOUT_GUARD_WINDOW_MS = 5000;

function isLogoutInProgress(): boolean {
  const raw = sessionStorage.getItem(LOGOUT_IN_PROGRESS_KEY);
  if (!raw) return false;
  const elapsed = Date.now() - Number(raw);
  return elapsed >= 0 && elapsed < LOGOUT_GUARD_WINDOW_MS;
}

export async function redirectToHostedUI(returnTo: string): Promise<void> {
  if (isLogoutInProgress()) return;
  const verifier = generateCodeVerifier();
  sessionStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier);
  sessionStorage.setItem(AUTH_RETURN_TO_STORAGE_KEY, returnTo);
  const codeChallenge = await generateCodeChallenge(verifier);
  const { domain, clientId } = getEnvConfig();
  const url = buildAuthorizeUrl({
    domain,
    clientId,
    redirectUri: `${window.location.origin}/auth/callback`,
    codeChallenge,
  });
  window.location.href = url;
}

export function logoutFromHostedUI(): void {
  sessionStorage.setItem(LOGOUT_IN_PROGRESS_KEY, String(Date.now()));
  const { domain, clientId } = getEnvConfig();
  const logoutUri = `${window.location.origin}/`;
  const query = new URLSearchParams({
    client_id: clientId,
    logout_uri: logoutUri,
  });
  window.location.href = `${domain}/logout?${query.toString()}`;
}
