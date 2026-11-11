// cobranca-e-plano-do-cliente RF2-30: resumo de cobrança da empresa ativa (GET /me/cobranca).
import api from '@/services/api';
import type {
  PlanoEFaturas,
  RecusaDaReativacao,
  RespostaDaReativacao,
  ResumoDeCobranca,
} from '@/types/cobranca';

export const CobrancaService = {
  resumo: async (tenantId: string): Promise<ResumoDeCobranca> => {
    const response = await api.get<ResumoDeCobranca>(`/me/cobranca?tenant_id=${encodeURIComponent(tenantId)}`);
    return response.data;
  },
};

// cobranca-e-plano-do-cliente RF3-01: plano e faturas da empresa ativa (GET /me/faturas).
export const FaturasService = {
  planoEFaturas: async (tenantId: string): Promise<PlanoEFaturas> => {
    const response = await api.get<PlanoEFaturas>(`/me/faturas?tenant_id=${encodeURIComponent(tenantId)}`);
    return response.data;
  },
};

// 409 com o código do §4.3 vira resultado tipado; qualquer outro erro vai para a tela.
function recusaDaReativacao(err: unknown): RecusaDaReativacao | null {
  if (typeof err !== 'object' || err === null || !('response' in err)) return null;
  const response = (err as { response?: { status?: number; data?: { error?: unknown } } }).response;
  if (response?.status !== 409) return null;
  if (response.data?.error === 'nao_pausada_por_cobranca') return { tipo: 'nao_pausada' };
  if (response.data?.error === 'cancellation_requested') return { tipo: 'cancelamento_pedido' };
  return null;
}

// cobranca-e-plano-do-cliente RF4-01: cobrança de reativação da empresa ativa
// (POST /me/reativacao, corpo vazio).
export const ReativacaoService = {
  pedir: async (tenantId: string): Promise<RespostaDaReativacao | RecusaDaReativacao> => {
    try {
      const response = await api.post<RespostaDaReativacao>(`/me/reativacao?tenant_id=${encodeURIComponent(tenantId)}`);
      return response.data;
    } catch (err) {
      const recusa = recusaDaReativacao(err);
      if (recusa) return recusa;
      throw err;
    }
  },
};
