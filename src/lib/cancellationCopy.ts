// Textos do cancelamento no Portal (portal-cancelamento RF-C4). Valores em R$ e datas
// em DD/MM/AAAA; a data não passa por Date para não deslocar o dia pelo fuso.
import type { CancellationPreview } from '@/services/api';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
    .format(value)
    .replace(/\u00a0/g, ' ');
}

export function formatDateBR(date: string): string {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

export function kindText(preview: CancellationPreview): string {
  switch (preview.kind) {
    case 'arrependimento':
      return `Você está no prazo de 7 dias para desistir. Devolvemos ${formatBRL(preview.refund?.value ?? 0)}. No Pix, a devolução é imediata; no cartão, o estorno aparece na fatura em até 10 dias úteis. Sua página sai do ar agora, e os dados da conta são excluídos em 30 dias.`;
    case 'fim_de_periodo':
      return `Não haverá novas cobranças. Sua página fica no ar até o fim do período pago e sai do ar em ${formatDateBR(preview.effective_at)}. Os dados da conta são excluídos 30 dias depois. Antes disso, exporte os contatos no CRM.`;
    case 'imediato':
      return 'Sua página sai do ar agora, sem novas cobranças. Os dados da conta são excluídos em 30 dias.';
    case 'sem_cobranca':
      return 'O pedido ainda não foi pago. Ele será cancelado agora e o endereço da página fica livre.';
    default:
      return '';
  }
}

export function refundStatusText(
  status: CancellationPreview['refund_status'],
  value: number,
): string {
  const formattedValue = formatBRL(value);

  switch (status) {
    case 'REQUESTED':
    case 'IN_PROGRESS':
      return `Assinatura cancelada. Devolução de ${formattedValue} em andamento.`;
    case 'DONE':
      return `Assinatura cancelada. Devolução de ${formattedValue} concluída.`;
    case 'FAILED':
      return `Assinatura cancelada. A devolução de ${formattedValue} está com a nossa equipe e será concluída em até 2 dias úteis.`;
    default:
      return 'Assinatura cancelada.';
  }
}
