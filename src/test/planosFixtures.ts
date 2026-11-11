import type { PlanoParaTroca, RespostaDosPlanos } from '@/types/planos';

// cobranca-e-plano-do-cliente RF5-01: fixtures no formato exato de GET /me/planos
// (TECH-DESIGN §4.3). Catálogo da conta de teste (tasks-fases-3-a-6 §2): basico 14,90
// (1 página, sem domínio próprio, 1 usuário, site), presenca 39,90 (3 páginas, 3 usuários,
// site e blog), captacao 69,90 (5 páginas, 10 usuários, site, blog e CRM, sem a marca).

export const presencaAtual: PlanoParaTroca = {
  slug: 'presenca',
  nome: 'Presença',
  valor: 39.9,
  destaques: ['Domínio próprio', 'Blog', 'Até 3 páginas'],
  paginas: 3,
  usuarios: 3,
  sem_dominio_proprio: false,
  sem_marca: false,
  servicos: ['site', 'blog'],
  direcao: 'atual',
  indisponivel_por: null,
};

export const captacaoUpgrade: PlanoParaTroca = {
  slug: 'captacao',
  nome: 'Captação',
  valor: 69.9,
  destaques: ['CRM', 'Até 5 páginas', 'Sem a assinatura "Feito com Unum People"'],
  paginas: 5,
  usuarios: 10,
  sem_dominio_proprio: false,
  sem_marca: true,
  servicos: ['site', 'blog', 'crm'],
  direcao: 'upgrade',
  indisponivel_por: null,
};

export const basicoDowngrade: PlanoParaTroca = {
  slug: 'basico',
  nome: 'Básico',
  valor: 14.9,
  destaques: ['1 página'],
  paginas: 1,
  usuarios: 1,
  sem_dominio_proprio: true,
  sem_marca: false,
  servicos: ['site'],
  direcao: 'downgrade',
  indisponivel_por: null,
};

// Conta em presenca: o atual e o upgrade, em ordem de valor (a API não manda o downgrade).
export const planosDaPadaria: RespostaDosPlanos = { planos: [presencaAtual, captacaoUpgrade] };

// Já no maior plano (ou contrato anual/personalizado): só o atual.
export const planosSoOAtual: RespostaDosPlanos = { planos: [presencaAtual] };
