import type { PlanoParaTroca } from '@/types/planos';

// metricas-de-visitas MV-75: o upgrade mais barato (valor) que passa no predicado.
// Sem a lista (erro na leitura) ou sem upgrade que libere: null ("Não incluso neste plano").
export function upgradeQueLibera(
  planos: PlanoParaTroca[] | null,
  libera: (p: PlanoParaTroca) => boolean,
): PlanoParaTroca | null {
  if (!planos) return null;
  return (
    planos
      .filter((p) => p.direcao === 'upgrade' && libera(p))
      .sort((a, b) => a.valor - b.valor)[0] ?? null
  );
}
