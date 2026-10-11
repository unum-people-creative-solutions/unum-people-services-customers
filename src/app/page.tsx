import { redirect } from "next/navigation";

type HomeProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

// A raiz do portal é o destino do redirecionamento do CRM e do blog-admin
// (?return_to=...&tenant_id=...). A query precisa acompanhar o redirecionamento
// para /termos: sem ela o portal esquece a origem e o tenant do termo pendente.
export default function Home({ searchParams = {} }: HomeProps) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      query.append(key, item);
    }
  }
  const qs = query.toString();
  redirect(qs ? `/termos?${qs}` : "/termos");
  return null;
}
