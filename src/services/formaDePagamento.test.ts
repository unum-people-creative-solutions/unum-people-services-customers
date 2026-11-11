import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { FormaDePagamento } from '@/types/planos';

// spec: cobranca-e-plano-do-cliente RF6-01, T93 (POST /me/forma-de-pagamento, TECH-DESIGN §4.3).

const mockPost = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: mockPost,
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    })),
  },
}));

vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ session: null, logout: vi.fn() }) } }));
vi.mock('@/lib/pkce', () => ({ redirectToHostedUI: vi.fn() }));

let mod: typeof import('./formaDePagamento');

beforeAll(async () => {
  mod = await import('./formaDePagamento');
});

beforeEach(() => {
  mockPost.mockReset();
});

describe('FormaDePagamentoService.trocar', () => {
  it('faz POST /me/forma-de-pagamento?tenant_id=t1 com o corpo exato {"billing_type":"BOLETO"}', async () => {
    mockPost.mockResolvedValue({ status: 204, data: '' });
    const forma: FormaDePagamento = 'BOLETO';
    await expect(mod.FormaDePagamentoService.trocar('t1', forma)).resolves.toBeUndefined();
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe('/me/forma-de-pagamento?tenant_id=t1');
    expect(JSON.stringify(mockPost.mock.calls[0][1])).toBe('{"billing_type":"BOLETO"}');
  });

  it.each<FormaDePagamento>(['PIX', 'BOLETO', 'CREDIT_CARD'])('manda %s como está, sem mudar maiúsculas', async (forma) => {
    mockPost.mockResolvedValue({ status: 204, data: '' });
    await mod.FormaDePagamentoService.trocar('t1', forma);
    expect(JSON.stringify(mockPost.mock.calls[0][1])).toBe(`{"billing_type":"${forma}"}`);
  });

  it('erro da API (403, 409, 500) chega a quem chamou', async () => {
    const recusa = { response: { status: 403, data: { error: 'forbidden', permissao: 'portal.contrato.cancelar' } } };
    mockPost.mockRejectedValueOnce(recusa);
    await expect(mod.FormaDePagamentoService.trocar('t1', 'PIX')).rejects.toBe(recusa);

    const naoAtiva = { response: { status: 409, data: { error: 'conta_nao_ativa' } } };
    mockPost.mockRejectedValueOnce(naoAtiva);
    await expect(mod.FormaDePagamentoService.trocar('t1', 'PIX')).rejects.toBe(naoAtiva);

    const falha = { response: { status: 500, data: { error: 'internal_error' } } };
    mockPost.mockRejectedValueOnce(falha);
    await expect(mod.FormaDePagamentoService.trocar('t1', 'PIX')).rejects.toBe(falha);
  });
});
