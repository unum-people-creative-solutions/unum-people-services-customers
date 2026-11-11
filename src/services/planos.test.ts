import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { ErroDaTroca, PlanoParaTroca } from '@/types/planos';
import { planosDaPadaria } from '@/test/planosFixtures';

// spec: cobranca-e-plano-do-cliente RF5-01, T81 (GET /me/planos e POST /me/plano, TECH-DESIGN §4.3).

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    })),
  },
}));

vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ session: null, logout: vi.fn() }) } }));
vi.mock('@/lib/pkce', () => ({ redirectToHostedUI: vi.fn() }));

let mod: typeof import('./planos');

beforeAll(async () => {
  mod = await import('./planos');
});

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
});

describe('PlanosService.listar', () => {
  it('faz GET /me/planos com o tenant_id pedido e devolve os planos do corpo', async () => {
    mockGet.mockResolvedValue({ data: planosDaPadaria });
    const planos: PlanoParaTroca[] = await mod.PlanosService.listar('t1');
    expect(mockGet).toHaveBeenCalledWith('/me/planos?tenant_id=t1');
    expect(planos).toEqual(planosDaPadaria.planos);
  });

  it('erro da API chega a quem chamou', async () => {
    const falha = { response: { status: 500, data: { error: 'internal_error' } } };
    mockGet.mockRejectedValue(falha);
    await expect(mod.PlanosService.listar('t1')).rejects.toBe(falha);
  });
});

describe('PlanosService.mudar', () => {
  it('faz POST /me/plano?tenant_id=t1 só com plan_slug no corpo; 204 → { ok: true }', async () => {
    mockPost.mockResolvedValue({ status: 204, data: '' });
    const resultado = await mod.PlanosService.mudar('t1', 'captacao');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/me/plano?tenant_id=t1', { plan_slug: 'captacao' });
    expect(JSON.stringify(mockPost.mock.calls[0][1])).toBe('{"plan_slug":"captacao"}');
    expect(resultado).toEqual({ ok: true });
  });

  const codigos: ErroDaTroca[] = [
    'conta_nao_ativa',
    'contrato_anual',
    'dominio_ligado',
    'paginas_acima_do_limite',
    'usuarios_acima_do_limite',
    'so_upgrade',
    'cancellation_requested',
  ];

  it.each(codigos)('409 %s → { ok: false, erro: código }', async (codigo) => {
    mockPost.mockRejectedValue({ response: { status: 409, data: { error: codigo } } });
    await expect(mod.PlanosService.mudar('t1', 'captacao')).resolves.toEqual({ ok: false, erro: codigo });
  });

  it('403 com permissao é lançado (a tela mostra a mensagem de permissão)', async () => {
    const recusa = { response: { status: 403, data: { error: 'forbidden', permissao: 'portal.contrato.cancelar' } } };
    mockPost.mockRejectedValue(recusa);
    await expect(mod.PlanosService.mudar('t1', 'captacao')).rejects.toBe(recusa);
  });

  it('500 e 409 com código fora do contrato são lançados', async () => {
    const falha = { response: { status: 500, data: { error: 'internal_error' } } };
    mockPost.mockRejectedValueOnce(falha);
    await expect(mod.PlanosService.mudar('t1', 'captacao')).rejects.toBe(falha);

    const desconhecido = { response: { status: 409, data: { error: 'outro_codigo' } } };
    mockPost.mockRejectedValueOnce(desconhecido);
    await expect(mod.PlanosService.mudar('t1', 'captacao')).rejects.toBe(desconhecido);
  });
});
