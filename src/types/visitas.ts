// metricas-de-visitas §3.9: espelho exato do contrato de GET /me/visitas (spec §3.4).
// Datas em AAAA-MM-DD, no dia de Brasília.

export type PeriodoDeVisitas = 7 | 30 | 90;
export type OrigemDaVisita = 'google' | 'instagram' | 'facebook' | 'whatsapp' | 'outros' | 'direto';
export type AparelhoDaVisita = 'celular' | 'computador';
export interface DiaDoGrafico { dia: string; visitas: number; toques: number }
// visitas-por-pagina VP-10: cada página da empresa, pelo slug e pelo endereço.
export interface PaginaDeVisitas { slug: string; endereco: string }
export interface VisitasDoPeriodo {
  disponivel: true;
  // VP-04: a página dos números ("" sem páginas) e todas as páginas da empresa.
  pagina: string;
  paginas: PaginaDeVisitas[];
  periodo: PeriodoDeVisitas;
  de: string;
  ate: string;
  totais: { visitas: number; toques: number };
  dias: DiaDoGrafico[];
  origens: Record<OrigemDaVisita, number>;
  aparelhos: Record<AparelhoDaVisita, number>;
}
export type RespostaDeVisitas = { disponivel: false } | VisitasDoPeriodo;
// Resultado do serviço: 404 vira 'inexistente' e 400 pagina_invalida vira 'paginaInvalida'
// (visitas-por-pagina VP-11); outros erros são lançados.
export type LeituraDeVisitas = RespostaDeVisitas | { inexistente: true } | { paginaInvalida: true };
