export function getSafeRedirect(url: string | null | undefined, defaultValue: string = "/termos"): string {
  if (!url) return defaultValue;

  // Paths relativos: uma única "/" inicial. O navegador trata "\" como "/" e descarta
  // tab/newline dentro da URL, então "/\evil.com" ou "/\t/evil.com" viram "//evil.com".
  // Por isso qualquer "\" ou caractere de controle/espaço recusa o valor.
  if (url.startsWith("/")) {
    if (!url.startsWith("//") && !/[\\\u0000-\u0020\u007f]/.test(url)) {
      return url;
    }
    return defaultValue;
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
