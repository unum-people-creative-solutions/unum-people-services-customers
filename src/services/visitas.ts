// metricas-de-visitas §3.9 (MV-71): visitas da empresa ativa (GET /me/visitas).
import api from '@/services/api';
import type { LeituraDeVisitas, PeriodoDeVisitas, RespostaDeVisitas } from '@/types/visitas';

// 404 = a empresa não tem a tela (situação "oculto", D-MV-24).
function ehInexistente(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('response' in err)) return false;
  return (err as { response?: { status?: number } }).response?.status === 404;
}

export const VisitasService = {
  // A rota decide a situação; o serviço só repassa. Qualquer erro que não seja 404 é lançado.
  ler: async (tenantId: string, periodo: PeriodoDeVisitas): Promise<LeituraDeVisitas> => {
    try {
      const response = await api.get<RespostaDeVisitas>(
        `/me/visitas?periodo=${periodo}&tenant_id=${encodeURIComponent(tenantId)}`,
      );
      return response.data;
    } catch (err) {
      if (ehInexistente(err)) return { inexistente: true };
      throw err;
    }
  },
};
