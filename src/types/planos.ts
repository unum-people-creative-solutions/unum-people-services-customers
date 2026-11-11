// cobranca-e-plano-do-cliente RF5-01: espelho exato do contrato de GET /me/planos e
// POST /me/plano (TECH-DESIGN §4.3, T15).

export type DirecaoDoPlano = 'atual' | 'upgrade' | 'downgrade';

export type MotivoIndisponivel = 'dominio_ligado' | 'paginas_acima_do_limite' | 'usuarios_acima_do_limite';

export interface PlanoParaTroca {
  slug: string;
  nome: string;
  valor: number;
  // Lista, nunca null.
  destaques: string[];
  paginas: number;
  // null = sem limite.
  usuarios: number | null;
  sem_dominio_proprio: boolean;
  sem_marca: boolean;
  // Lista, nunca null ("site", "blog", "crm").
  servicos: string[];
  direcao: DirecaoDoPlano;
  // null quando o plano pode ser escolhido.
  indisponivel_por: MotivoIndisponivel | null;
}

export interface RespostaDosPlanos {
  planos: PlanoParaTroca[];
}

// Os códigos de 409 de POST /me/plano (T80; cancellation_requested pela DV-35).
export type ErroDaTroca =
  | 'conta_nao_ativa'
  | 'contrato_anual'
  | 'dominio_ligado'
  | 'paginas_acima_do_limite'
  | 'usuarios_acima_do_limite'
  | 'so_upgrade'
  | 'cancellation_requested';

export type ResultadoDaTroca = { ok: true } | { ok: false; erro: ErroDaTroca };

// cobranca-e-plano-do-cliente RF6-01: as formas aceitas por POST /me/forma-de-pagamento
// (TECH-DESIGN §4.3), exatamente como a API espera.
export type FormaDePagamento = 'PIX' | 'BOLETO' | 'CREDIT_CARD';
