import type { PlanoEFaturas, ResumoDeCobranca } from '@/types/cobranca';

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

// cobranca-e-plano-do-cliente RF3-01: fixtures no formato exato de GET /me/faturas
// (TECH-DESIGN §4.2).

// O exemplo do §4.2, campo a campo.
export const planoEFaturasDoContrato: PlanoEFaturas = {
  plano: {
    slug: 'presenca',
    nome: 'Presença',
    valor: 39.9,
    ciclo: 'mensal',
    proximo_vencimento: '2026-12-05',
    forma_de_pagamento: 'PIX',
    destaques: ['...'],
  },
  faturas: [
    {
      id: 'pay_123',
      valor: 39.9,
      vencimento: '2026-11-05',
      situacao: 'paga',
      pago_em: '2026-11-04',
      link: 'https://www.asaas.com/i/abc',
      nota_fiscal_url: 'https://...',
    },
  ],
  pode_gerir: true,
};

// Conta de teste "Padaria Zé" no plano Presença (tasks-fases-3-a-6 §2): a vencer em
// 05/12, paga em 04/11 (com nota fiscal) e estornada em 05/10, da mais nova à mais antiga.
export const planoEFaturasDaPadaria: PlanoEFaturas = {
  plano: {
    slug: 'presenca',
    nome: 'Presença',
    valor: 39.9,
    ciclo: 'mensal',
    proximo_vencimento: '2026-12-05',
    forma_de_pagamento: 'PIX',
    destaques: ['Domínio próprio', 'Blog', 'Até 3 páginas'],
  },
  faturas: [
    { id: 'pay_3', valor: 39.9, vencimento: '2026-12-05', situacao: 'a_vencer', link: 'https://www.asaas.com/i/pay3' },
    {
      id: 'pay_2',
      valor: 39.9,
      vencimento: '2026-11-05',
      situacao: 'paga',
      pago_em: '2026-11-04',
      link: 'https://www.asaas.com/i/pay2',
      nota_fiscal_url: 'https://nf.example.com/pay2.pdf',
    },
    { id: 'pay_1', valor: 39.9, vencimento: '2026-10-05', situacao: 'estornada', link: 'https://www.asaas.com/i/pay1' },
  ],
  pode_gerir: true,
};

// Quem não gere o contrato: a API não manda link nem nota fiscal.
export const planoEFaturasDaPadariaSemGerir: PlanoEFaturas = {
  ...planoEFaturasDaPadaria,
  faturas: planoEFaturasDaPadaria.faturas.map(({ link: _link, nota_fiscal_url: _nota, ...fatura }) => fatura),
  pode_gerir: false,
};
