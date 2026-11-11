// cobranca-e-plano-do-cliente RF2-30: resumo de cobrança da empresa ativa (GET /me/cobranca).
import api from '@/services/api';
import type { ResumoDeCobranca } from '@/types/cobranca';

export const CobrancaService = {
  resumo: async (tenantId: string): Promise<ResumoDeCobranca> => {
    const response = await api.get<ResumoDeCobranca>(`/me/cobranca?tenant_id=${encodeURIComponent(tenantId)}`);
    return response.data;
  },
};
