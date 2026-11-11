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

// RF2-32a: conta INADIMPLENTE sem `DelinquencySince` (antiga ou alterada à mão). Corpo literal
// que a API produz (cobranca_service_test.go, "INADIMPLENTE sem DelinquencySince → em_atraso sem datas").
export const resumoEmAtrasoSemDatas: ResumoDeCobranca = JSON.parse(
  '{"situacao":"em_atraso","fatura":{"valor":39.9,"vencimento":"2026-11-05","link":"https://www.asaas.com/i/abc"},"ferramentas_bloqueadas":[],"pode_gerir":true}',
);

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

// R6 (T11) com o único par que a fatura mensal produz (TECH-DESIGN, proposta A; Verifier F2 r2,
// N2): faturas de 31/01 e 28/02, as duas vencidas em 01/03 (D+29 de 31/01), conta `bloqueado`.
// A `fatura` é a vencida mais antiga e `DelinquencySince` é o vencimento dela, então as cinco
// datas partem de 31/01 (D+0, D+9, D+10, D+30, D+60).
export const RELOGIO_DO_PARCIAL = new Date('2026-03-01T15:00:00Z').getTime();

export const resumoBloqueadoAntesDoParcial: ResumoDeCobranca = {
  ...resumoBloqueado,
  fatura: { valor: 39.9, vencimento: '2026-01-31', link: 'https://www.asaas.com/i/jan' },
  vencida_em: '2026-01-31',
  pagar_ate: '2026-02-09',
  bloqueio_em: '2026-02-10',
  fora_do_ar_em: '2026-03-02',
  cancelamento_em: '2026-04-01',
};

// Pago o 31/01, o RF1-20 move `DelinquencySince` para 28/02 (dias = 1): a conta volta a
// INADIMPLENTE, `em_atraso` sem ferramentas bloqueadas, com as datas a partir de 28/02.
export const resumoEmAtrasoDepoisDoParcial: ResumoDeCobranca = {
  ...resumoEmAtraso,
  fatura: { valor: 39.9, vencimento: '2026-02-28', link: 'https://www.asaas.com/i/fev' },
  vencida_em: '2026-02-28',
  pagar_ate: '2026-03-09',
  bloqueio_em: '2026-03-10',
  fora_do_ar_em: '2026-03-30',
  cancelamento_em: '2026-04-29',
  ferramentas_bloqueadas: [],
};
