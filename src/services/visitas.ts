// metricas-de-visitas §3.9 (MV-71): visitas da empresa ativa (GET /me/visitas).
import api from '@/services/api';
import type { LeituraDeVisitas, PeriodoDeVisitas, RespostaDeVisitas } from '@/types/visitas';

// 404 = a empresa não tem a tela (situação "oculto", D-MV-24).
function ehInexistente(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('response' in err)) return false;
  return (err as { response?: { status?: number } }).response?.status === 404;
}

// visitas-por-pagina VP-11: 400 pagina_invalida = a página pedida não é mais da empresa.
function ehPaginaInvalida(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('response' in err)) return false;
  const response = (err as { response?: { status?: number; data?: { error?: unknown } } }).response;
  return response?.status === 400 && response.data?.error === 'pagina_invalida';
}

export const VisitasService = {
  // A rota decide a situação; o serviço só repassa. Qualquer erro que não seja 404 é lançado.
  // VP-11: sem página (ou vazia), a URL é a de antes e a API escolhe a primeira.
  ler: async (tenantId: string, periodo: PeriodoDeVisitas, pagina?: string): Promise<LeituraDeVisitas> => {
    const daPagina = pagina ? `&pagina=${encodeURIComponent(pagina)}` : '';
    try {
      const response = await api.get<RespostaDeVisitas>(
        `/me/visitas?periodo=${periodo}&tenant_id=${encodeURIComponent(tenantId)}${daPagina}`,
      );
      return response.data;
    } catch (err) {
      if (ehInexistente(err)) return { inexistente: true };
      if (ehPaginaInvalida(err)) return { paginaInvalida: true };
      throw err;
    }
  },
};
