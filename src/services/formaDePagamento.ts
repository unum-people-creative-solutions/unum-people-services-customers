// cobranca-e-plano-do-cliente RF6-01: troca da forma de pagamento da empresa ativa
// (POST /me/forma-de-pagamento, TECH-DESIGN §4.3). 204 sem corpo; todo erro vai para a tela.
import api from '@/services/api';
import type { FormaDePagamento } from '@/types/planos';

export const FormaDePagamentoService = {
  trocar: async (tenantId: string, forma: FormaDePagamento): Promise<void> => {
    await api.post(`/me/forma-de-pagamento?tenant_id=${encodeURIComponent(tenantId)}`, { billing_type: forma });
  },
};
