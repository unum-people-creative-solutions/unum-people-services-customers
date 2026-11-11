// Textos da cobrança no Portal (cobranca-e-plano-do-cliente RF2-21–RF2-23, RF2-34).
// A data AAAA-MM-DD já vem no dia de Brasília: só reordena o texto, sem Date,
// para não voltar um dia pelo fuso.
import type { ResumoDeCobranca } from '@/types/cobranca';
import { formatBRL } from '@/lib/cancellationCopy';

export function formatarData(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

export function formatarReais(valor: number): string {
  return formatBRL(valor);
}

// "Páginas" sempre; "CRM" e "blog" só se a conta tem (BP-T D-3).
export function ferramentasCitadas(servicos: string[]): string {
  const nomes = ['Páginas'];
  if (servicos.includes('crm')) nomes.push('CRM');
  if (servicos.includes('blog')) nomes.push('blog');
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

const NOME_DA_SITUACAO: Record<Exclude<ResumoDeCobranca['situacao'], 'outra'>, string> = {
  em_dia: 'Em dia',
  em_atraso: 'Fatura em atraso',
  bloqueado: 'Acesso bloqueado',
  fora_do_ar: 'Fora do ar',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
};

const NOME_DO_STATUS: Record<string, string> = {
  AGUARDANDO_ATIVACAO: 'Aguardando o primeiro pagamento',
  PENDENTE_ASAAS: 'Em ativação',
  SUSPENSO: 'Suspensa',
  EXCLUINDO: 'Cancelada',
};

export function nomeDaSituacao(resumo: ResumoDeCobranca, tenantStatus: string): string {
  if (resumo.situacao !== 'outra') return NOME_DA_SITUACAO[resumo.situacao];
  return NOME_DO_STATUS[tenantStatus] ?? 'Fale com a gente';
}
