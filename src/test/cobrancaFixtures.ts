import type { ResumoDeCobranca } from '@/types/cobranca';

// cobranca-e-plano-do-cliente RF2-20: fixtures no formato exato de GET /me/cobranca
// (TECH-DESIGN §4.1). Conta com atraso desde 2026-11-05 (D+0, D+9, D+10, D+30, D+60).

// O exemplo do §4.1, campo a campo.
export const resumoEmAtraso: ResumoDeCobranca = {
  situacao: 'em_atraso',
  fatura: { valor: 39.9, vencimento: '2026-11-05', link: 'https://www.asaas.com/i/abc' },
  vencida_em: '2026-11-05',
  pagar_ate: '2026-11-14',
  bloqueio_em: '2026-11-15',
  fora_do_ar_em: '2026-12-05',
  cancelamento_em: '2027-01-04',
  ferramentas_bloqueadas: [],
  pode_gerir: true,
};

// Quem não gere o contrato: a API não manda o link.
export const resumoEmAtrasoSemGerir: ResumoDeCobranca = {
  ...resumoEmAtraso,
  fatura: { valor: 39.9, vencimento: '2026-11-05' },
  pode_gerir: false,
};

export const resumoEmAtrasoSemFatura: ResumoDeCobranca = {
  ...resumoEmAtraso,
  fatura: null,
};

export const resumoBloqueado: ResumoDeCobranca = {
  ...resumoEmAtraso,
  situacao: 'bloqueado',
  ferramentas_bloqueadas: ['crm', 'blog', 'lp'],
};

export const resumoForaDoAr: ResumoDeCobranca = {
  ...resumoEmAtraso,
  situacao: 'fora_do_ar',
  fatura: null,
  ferramentas_bloqueadas: ['crm', 'blog', 'lp'],
};

// Conta em dia: o corpo exato do §4.1.
export const resumoEmDia: ResumoDeCobranca = {
  situacao: 'em_dia',
  fatura: null,
  ferramentas_bloqueadas: [],
  pode_gerir: true,
};
