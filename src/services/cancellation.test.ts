import { vi, describe, it, expect, beforeEach } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      ...http,
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    })),
  },
}));
vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ session: null, logout: vi.fn() }) } }));
vi.mock('@/lib/pkce', () => ({ redirectToHostedUI: vi.fn() }));

import { CancellationService, type CancellationPreview } from './api';

const previa: CancellationPreview = {
  can_cancel: true,
  reason: '',
  kind: 'arrependimento',
  effective_at: '2026-10-12',
  refund: { value: 129.9, billing_type: 'PIX' },
  refund_deadline: '2026-10-17',
  purge_days: 30,
  scheduled: null,
};

// portal-cancelamento RF-C1: contrato de GET/POST /me/cancellation (RF-B8).
describe('CancellationService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getPreview busca /me/cancellation do tenant ativo', async () => {
    http.get.mockResolvedValue({ data: previa });
    await expect(CancellationService.getPreview('t-1')).resolves.toEqual(previa);
    expect(http.get).toHaveBeenCalledWith('/me/cancellation?tenant_id=t-1');
  });

  it('getPreview sem tenant usa o do token', async () => {
    http.get.mockResolvedValue({ data: previa });
    await CancellationService.getPreview();
    expect(http.get).toHaveBeenCalledWith('/me/cancellation');
  });

  it('request envia o kind confirmado e devolve a prévia nova', async () => {
    const depois = { ...previa, can_cancel: false, reason: 'already_cancelled', refund_status: 'REQUESTED' };
    http.post.mockResolvedValue({ data: depois });
    await expect(CancellationService.request('arrependimento', 't-1')).resolves.toEqual({ status: 'done', preview: depois });
    expect(http.post).toHaveBeenCalledWith('/me/cancellation?tenant_id=t-1', { kind: 'arrependimento' });
  });

  it('409 cancellation_kind_changed devolve a prévia nova em vez de erro', async () => {
    const nova = { ...previa, kind: 'fim_de_periodo', effective_at: '2026-11-10', refund: null, refund_deadline: '' };
    http.post.mockRejectedValue({ response: { status: 409, data: { error: 'cancellation_kind_changed', preview: nova } } });
    await expect(CancellationService.request('arrependimento')).resolves.toEqual({ status: 'kind_changed', preview: nova });
  });

  it('outros erros propagam', async () => {
    const erro = { response: { status: 502, data: { error: 'asaas_unavailable' } } };
    http.post.mockRejectedValue(erro);
    await expect(CancellationService.request('imediato')).rejects.toBe(erro);
  });
});
