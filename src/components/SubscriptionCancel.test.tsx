import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SubscriptionCancel from './SubscriptionCancel';
import { CancellationService, type CancellationPreview } from '@/services/api';

vi.mock('@/services/api', () => ({
  CancellationService: { getPreview: vi.fn(), request: vi.fn() },
}));

const getPreview = CancellationService.getPreview as unknown as ReturnType<typeof vi.fn>;
const request = CancellationService.request as unknown as ReturnType<typeof vi.fn>;

const arrependimento: CancellationPreview = {
  can_cancel: true, reason: '', kind: 'arrependimento', effective_at: '2026-10-12',
  refund: { value: 129.9, billing_type: 'PIX' }, refund_deadline: '2026-10-17', purge_days: 30, scheduled: null,
};
const fimDePeriodo: CancellationPreview = {
  ...arrependimento, kind: 'fim_de_periodo', effective_at: '2026-11-10', refund: null, refund_deadline: '',
};

async function abrirDialogo() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Cancelar assinatura' }));
  return { user, dialog: screen.getByRole('dialog', { name: 'Cancelar assinatura' }) };
}

// portal-cancelamento RF-C2/RF-C3/CA-14.
describe('SubscriptionCancel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('busca a prévia do tenant ativo', async () => {
    getPreview.mockResolvedValue(arrependimento);
    render(<SubscriptionCancel tenantId="t-1" />);
    await screen.findByRole('button', { name: 'Cancelar assinatura' });
    expect(getPreview).toHaveBeenCalledWith('t-1');
  });

  it('arrependimento: o diálogo mostra o valor e confirma com kind=arrependimento', async () => {
    getPreview.mockResolvedValue(arrependimento);
    request.mockResolvedValue({ status: 'done', preview: { ...arrependimento, can_cancel: false, reason: 'already_cancelled', kind: '', refund_status: 'REQUESTED' } });
    render(<SubscriptionCancel tenantId="t-1" />);
    const { user, dialog } = await abrirDialogo();

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText(/Devolvemos R\$ 129,90\./)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' }));

    expect(request).toHaveBeenCalledWith('arrependimento', 't-1');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Assinatura cancelada. Devolução de R$ 129,90 em andamento.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar assinatura' })).not.toBeInTheDocument();
  });

  it('fim de período: depois de confirmar mostra a data agendada', async () => {
    getPreview.mockResolvedValue(fimDePeriodo);
    request.mockResolvedValue({ status: 'done', preview: { ...fimDePeriodo, can_cancel: false, reason: 'already_scheduled', kind: '', scheduled: { cancel_at: '2026-11-10', requested_at: '2026-10-20T13:00:00Z' } } });
    render(<SubscriptionCancel />);
    const { user, dialog } = await abrirDialogo();
    expect(within(dialog).getByText(/sai do ar em 10\/11\/2026/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' }));
    expect(request).toHaveBeenCalledWith('fim_de_periodo', undefined);
    expect(await screen.findByText('Cancelamento agendado. Sua página sai do ar em 10/11/2026.')).toBeInTheDocument();
  });

  it('409 kind_changed: troca o texto, avisa e mantém o diálogo aberto', async () => {
    getPreview.mockResolvedValue(arrependimento);
    request.mockResolvedValue({ status: 'kind_changed', preview: fimDePeriodo });
    render(<SubscriptionCancel />);
    const { user, dialog } = await abrirDialogo();
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' }));

    expect(await within(dialog).findByText('O prazo mudou desde que você abriu esta janela. Confira antes de confirmar.')).toBeInTheDocument();
    expect(within(dialog).getByText(/sai do ar em 10\/11\/2026/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/Devolvemos/)).not.toBeInTheDocument();
    // Confirmar de novo manda o desfecho novo.
    request.mockResolvedValue({ status: 'done', preview: { ...fimDePeriodo, can_cancel: false, reason: 'already_scheduled', scheduled: { cancel_at: '2026-11-10', requested_at: 'x' } } });
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' }));
    expect(request).toHaveBeenLastCalledWith('fim_de_periodo', undefined);
  });

  it('erro: mostra o alerta e reabilita o botão', async () => {
    getPreview.mockResolvedValue(arrependimento);
    request.mockRejectedValue({ response: { status: 502, data: { error: 'asaas_unavailable' } } });
    render(<SubscriptionCancel />);
    const { user, dialog } = await abrirDialogo();
    const confirmar = within(dialog).getByRole('button', { name: 'Confirmar cancelamento' });
    await user.click(confirmar);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Não foi possível cancelar agora. Nada foi alterado. Tente de novo em alguns minutos.',
    );
    expect(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' })).toBeEnabled();
  });

  it('durante o envio o botão fica desabilitado com "Cancelando…"', async () => {
    getPreview.mockResolvedValue(arrependimento);
    let resolver: (v: unknown) => void = () => {};
    request.mockReturnValue(new Promise((r) => { resolver = r; }));
    render(<SubscriptionCancel />);
    const { user, dialog } = await abrirDialogo();
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' }));
    expect(within(dialog).getByRole('button', { name: 'Cancelando…' })).toBeDisabled();
    resolver({ status: 'done', preview: { ...arrependimento, can_cancel: false, reason: 'already_cancelled', refund_status: 'REQUESTED' } });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Esc e Voltar fecham sem cancelar e devolvem o foco ao botão', async () => {
    getPreview.mockResolvedValue(arrependimento);
    render(<SubscriptionCancel />);
    const { user } = await abrirDialogo();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar assinatura' })).toHaveFocus();

    const again = await abrirDialogo();
    await again.user.click(within(again.dialog).getByRole('button', { name: 'Voltar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('o foco abre dentro do diálogo e não sai dele com Tab', async () => {
    getPreview.mockResolvedValue(arrependimento);
    render(<SubscriptionCancel />);
    const { user, dialog } = await abrirDialogo();
    expect(dialog.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 4; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('não admin: avisa e não mostra o botão', async () => {
    getPreview.mockResolvedValue({ ...arrependimento, can_cancel: false, reason: 'not_admin', kind: '' });
    render(<SubscriptionCancel />);
    expect(await screen.findByText('Só o administrador da conta pode cancelar a assinatura.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar assinatura' })).not.toBeInTheDocument();
  });

  it('agendado: mostra a data', async () => {
    getPreview.mockResolvedValue({ ...fimDePeriodo, can_cancel: false, reason: 'already_scheduled', kind: '', scheduled: { cancel_at: '2026-11-10', requested_at: 'x' } });
    render(<SubscriptionCancel />);
    expect(await screen.findByText('Cancelamento agendado. Sua página sai do ar em 10/11/2026.')).toBeInTheDocument();
  });

  it('cancelado com devolução: mostra o status', async () => {
    getPreview.mockResolvedValue({ ...arrependimento, can_cancel: false, reason: 'already_cancelled', kind: '', refund_status: 'FAILED' });
    render(<SubscriptionCancel />);
    expect(await screen.findByText('Assinatura cancelada. A devolução de R$ 129,90 está com a nossa equipe e será concluída em até 2 dias úteis.')).toBeInTheDocument();
  });

  it('plano livre: o bloco não aparece', async () => {
    getPreview.mockResolvedValue({ ...arrependimento, can_cancel: false, reason: 'plan_livre', kind: '', refund: null });
    const { container } = render(<SubscriptionCancel />);
    await waitFor(() => expect(getPreview).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('falha ao carregar a prévia: avisa, sem botão inerte', async () => {
    getPreview.mockRejectedValue(new Error('rede'));
    render(<SubscriptionCancel />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os dados da assinatura.');
    expect(screen.queryByRole('button', { name: 'Cancelar assinatura' })).not.toBeInTheDocument();
  });
});
