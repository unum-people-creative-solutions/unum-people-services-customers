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

// cobranca-e-plano-do-cliente RF3-01: espelho exato do contrato de GET /me/faturas
// (TECH-DESIGN §4.2).

export type SituacaoDaFatura = 'a_vencer' | 'paga' | 'vencida' | 'estornada';

export type CicloDoPlano = 'mensal' | 'anual';

export interface PlanoDoCliente {
  slug: string;
  nome: string;
  valor: number;
  ciclo: CicloDoPlano;
  // Ausente quando o contrato não tem paid_until.
  proximo_vencimento?: string;
  // SubscriptionBillingType do contrato, como está (PIX, BOLETO, CREDIT_CARD, UNDEFINED ou vazio).
  forma_de_pagamento: string;
  // Lista, nunca null.
  destaques: string[];
}

export interface FaturaDoCliente {
  id: string;
  valor: number;
  vencimento: string;
  situacao: SituacaoDaFatura;
  pago_em?: string;
  // Ausentes quando pode_gerir é false.
  link?: string;
  nota_fiscal_url?: string;
}

export interface PlanoEFaturas {
  plano: PlanoDoCliente;
  // Vencimento da mais nova para a mais antiga; lista, nunca null.
  faturas: FaturaDoCliente[];
  pode_gerir: boolean;
}
