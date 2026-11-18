// metricas-de-visitas §3.9: espelho exato do contrato de GET /me/visitas (spec §3.4).
// Datas em AAAA-MM-DD, no dia de Brasília.

export type PeriodoDeVisitas = 7 | 30 | 90;
export type OrigemDaVisita = 'google' | 'instagram' | 'facebook' | 'whatsapp' | 'outros' | 'direto';
export type AparelhoDaVisita = 'celular' | 'computador';
export interface DiaDoGrafico { dia: string; visitas: number; toques: number }
export interface VisitasDoPeriodo {
  disponivel: true;
  periodo: PeriodoDeVisitas;
  de: string;
  ate: string;
  totais: { visitas: number; toques: number };
  dias: DiaDoGrafico[];
  origens: Record<OrigemDaVisita, number>;
  aparelhos: Record<AparelhoDaVisita, number>;
}
export type RespostaDeVisitas = { disponivel: false } | VisitasDoPeriodo;
// Resultado do serviço: 404 vira 'inexistente'; outros erros são lançados.
export type LeituraDeVisitas = RespostaDeVisitas | { inexistente: true };
