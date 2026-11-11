// cobranca-e-plano-do-cliente RF5-01: planos para trocar e troca de plano da empresa ativa
// (GET /me/planos e POST /me/plano, TECH-DESIGN §4.3).
import api from '@/services/api';
import type { ErroDaTroca, PlanoParaTroca, RespostaDosPlanos, ResultadoDaTroca } from '@/types/planos';

const CODIGOS_DA_TROCA: readonly ErroDaTroca[] = [
  'conta_nao_ativa',
  'contrato_anual',
  'dominio_ligado',
  'paginas_acima_do_limite',
  'usuarios_acima_do_limite',
  'so_upgrade',
  'cancellation_requested',
];

// 409 com um código do contrato vira resultado tipado; qualquer outro erro vai para a tela.
function recusaDaTroca(err: unknown): ErroDaTroca | null {
  if (typeof err !== 'object' || err === null || !('response' in err)) return null;
  const response = (err as { response?: { status?: number; data?: { error?: unknown } } }).response;
  if (response?.status !== 409) return null;
  const codigo = response.data?.error;
  return CODIGOS_DA_TROCA.find((c) => c === codigo) ?? null;
}

export const PlanosService = {
  listar: async (tenantId: string): Promise<PlanoParaTroca[]> => {
    const response = await api.get<RespostaDosPlanos>(`/me/planos?tenant_id=${encodeURIComponent(tenantId)}`);
    return response.data.planos;
  },
  mudar: async (tenantId: string, planSlug: string): Promise<ResultadoDaTroca> => {
    try {
      await api.post(`/me/plano?tenant_id=${encodeURIComponent(tenantId)}`, { plan_slug: planSlug });
      return { ok: true };
    } catch (err) {
      const erro = recusaDaTroca(err);
      if (erro) return { ok: false, erro };
      throw err;
    }
  },
};
