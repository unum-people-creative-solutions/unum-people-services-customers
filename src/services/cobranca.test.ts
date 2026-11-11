import { vi, describe, it, expect, beforeAll } from 'vitest';
import type { ResumoDeCobranca } from '@/types/cobranca';
import { resumoEmAtraso, resumoEmDia } from '@/test/cobrancaFixtures';

// spec: cobranca-e-plano-do-cliente RF2-30 (GET /me/cobranca da empresa ativa) e RF2-20.

const mockGet = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    })),
  },
}));

vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ session: null, logout: vi.fn() }) } }));
vi.mock('@/lib/pkce', () => ({ redirectToHostedUI: vi.fn() }));

let mod: typeof import('./cobranca');

beforeAll(async () => {
  mod = await import('./cobranca');
});

describe('CobrancaService.resumo', () => {
  it('faz GET /me/cobranca com o tenant_id da empresa ativa e devolve o corpo como veio', async () => {
    mockGet.mockResolvedValue({ data: resumoEmAtraso });
    const resultado: ResumoDeCobranca = await mod.CobrancaService.resumo('3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b');
    expect(mockGet).toHaveBeenCalledWith('/me/cobranca?tenant_id=3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b');
    expect(resultado).toEqual(resumoEmAtraso);
  });

  it('conta em dia: devolve o corpo exato do contrato', async () => {
    mockGet.mockResolvedValue({ data: resumoEmDia });
    const resultado = await mod.CobrancaService.resumo('tenant-B');
    expect(mockGet).toHaveBeenLastCalledWith('/me/cobranca?tenant_id=tenant-B');
    expect(resultado).toEqual({ situacao: 'em_dia', fatura: null, ferramentas_bloqueadas: [], pode_gerir: true });
  });

  it('erro da API chega a quem chamou (a tela mostra o erro)', async () => {
    const falha = new Error('Network Error');
    mockGet.mockRejectedValue(falha);
    await expect(mod.CobrancaService.resumo('tenant-B')).rejects.toBe(falha);
  });
});
