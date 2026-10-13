import { describe, it, expect } from 'vitest';
import { formatBRL, formatDateBR, kindText, refundStatusText } from './cancellationCopy';
import type { CancellationPreview } from '@/services/api';

const base: CancellationPreview = {
  can_cancel: true, reason: '', kind: 'arrependimento', effective_at: '2026-10-12',
  refund: { value: 129.9, billing_type: 'PIX' }, refund_deadline: '2026-10-17', purge_days: 30, scheduled: null,
};

// portal-cancelamento RF-C4: textos exatos de cada desfecho.
describe('cancellationCopy', () => {
  it('formata valor e data no padrão brasileiro', () => {
    expect(formatBRL(129.9)).toBe('R$ 129,90');
    expect(formatBRL(1299)).toBe('R$ 1.299,00');
    expect(formatDateBR('2026-11-10')).toBe('10/11/2026');
  });

  it('arrependimento', () => {
    expect(kindText(base)).toBe(
      'Você está no prazo de 7 dias para desistir. Devolvemos R$ 129,90. No Pix, a devolução é imediata; no cartão, o estorno aparece na fatura em até 10 dias úteis. Sua página sai do ar agora, e os dados da conta são excluídos em 30 dias.',
    );
  });

  it('fim de período', () => {
    expect(kindText({ ...base, kind: 'fim_de_periodo', effective_at: '2026-11-10', refund: null })).toBe(
      'Não haverá novas cobranças. Sua página fica no ar até o fim do período pago e sai do ar em 10/11/2026. Os dados da conta são excluídos 30 dias depois. Antes disso, exporte os contatos no CRM.',
    );
  });

  it('imediato e sem cobrança', () => {
    expect(kindText({ ...base, kind: 'imediato', refund: null })).toBe(
      'Sua página sai do ar agora, sem novas cobranças. Os dados da conta são excluídos em 30 dias.',
    );
    expect(kindText({ ...base, kind: 'sem_cobranca', refund: null })).toBe(
      'O pedido ainda não foi pago. Ele será cancelado agora e o endereço da página fica livre.',
    );
  });

  it('status da devolução', () => {
    expect(refundStatusText('REQUESTED', 129.9)).toBe('Assinatura cancelada. Devolução de R$ 129,90 em andamento.');
    expect(refundStatusText('IN_PROGRESS', 129.9)).toBe('Assinatura cancelada. Devolução de R$ 129,90 em andamento.');
    expect(refundStatusText('DONE', 129.9)).toBe('Assinatura cancelada. Devolução de R$ 129,90 concluída.');
    expect(refundStatusText('FAILED', 129.9)).toBe(
      'Assinatura cancelada. A devolução de R$ 129,90 está com a nossa equipe e será concluída em até 2 dias úteis.',
    );
  });
});
