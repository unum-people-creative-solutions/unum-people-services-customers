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

// Sem atraso por cobrança (T4): `fatura` null e sem as cinco datas.
export const resumoPausada: ResumoDeCobranca = { ...resumoEmDia, situacao: 'pausada' };
export const resumoCancelada: ResumoDeCobranca = { ...resumoEmDia, situacao: 'cancelada' };

// R6 (T11), antes do pagamento parcial: duas faturas vencidas (05/10 e 05/11). A `fatura` é a
// vencida mais antiga e `DelinquencySince` é o vencimento dela, então as cinco datas partem de 05/10.
const faturaDe0510 = { valor: 39.9, vencimento: '2026-10-05', link: 'https://www.asaas.com/i/abc' };
const datasDesde0510 = {
  vencida_em: '2026-10-05',
  pagar_ate: '2026-10-14',
  bloqueio_em: '2026-10-15',
  fora_do_ar_em: '2026-11-04',
  cancelamento_em: '2026-12-04',
};

export const resumoEmAtrasoAntesDoParcial: ResumoDeCobranca = {
  ...resumoEmAtraso,
  fatura: faturaDe0510,
  ...datasDesde0510,
};

export const resumoBloqueadoAntesDoParcial: ResumoDeCobranca = {
  ...resumoBloqueado,
  fatura: faturaDe0510,
  ...datasDesde0510,
};
