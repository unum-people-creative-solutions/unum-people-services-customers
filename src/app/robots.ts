import type { MetadataRoute } from "next";

// Portal só para clientes logados: nenhuma página deve ser rastreada (ver o
// robots dos metadados em layout.tsx).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
