// cobranca-e-plano-do-cliente RF2-20: espelho exato do contrato de GET /me/cobranca
// (TECH-DESIGN §4.1). Datas em AAAA-MM-DD, no dia de Brasília.

export type SituacaoDeCobranca =
  | 'em_dia'
  | 'em_atraso'
  | 'bloqueado'
  | 'fora_do_ar'
  | 'pausada'
  | 'cancelada'
  | 'outra';

export type FerramentaBloqueada = 'crm' | 'blog' | 'lp';

export interface FaturaDoResumo {
  valor: number;
  vencimento: string;
  // Ausente quando pode_gerir é false.
  link?: string;
}

export interface ResumoDeCobranca {
  situacao: SituacaoDeCobranca;
  fatura: FaturaDoResumo | null;
  // As cinco datas só vêm quando há atraso por cobrança.
  vencida_em?: string;
  pagar_ate?: string;
  bloqueio_em?: string;
  fora_do_ar_em?: string;
  cancelamento_em?: string;
  // Lista, nunca null.
  ferramentas_bloqueadas: FerramentaBloqueada[];
  pode_gerir: boolean;
}
