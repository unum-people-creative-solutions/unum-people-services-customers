export function getSafeRedirect(url: string | null | undefined, defaultValue: string = "/termos"): string {
  if (!url) return defaultValue;

  // Paths relativos começando com "/" (impedindo "//" para evitar redirecionamento oculto)
  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }

  // URLs absolutas com protocolo http ou https
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      const hostname = parsed.hostname;
      if (hostname === "unumpeople.com.br" || hostname.endsWith(".unumpeople.com.br")) {
        return url;
      }
    }
  } catch (err) {
    // Ignora erros de parsing
  }

  return defaultValue;
}
