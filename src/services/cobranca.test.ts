import { vi, describe, it, expect, beforeAll } from 'vitest';
import type { PlanoEFaturas, ResumoDeCobranca } from '@/types/cobranca';
import {
  planoEFaturasDoContrato,
  respostaDaReativacao,
  resumoEmAtraso,
  resumoEmDia,
  resumoForaDoAr,
  resumoForaDoArComReativacaoPendente,
} from '@/test/cobrancaFixtures';

// spec: cobranca-e-plano-do-cliente RF2-30 (GET /me/cobranca da empresa ativa) e RF2-20.

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

// spec: cobranca-e-plano-do-cliente RF3-01/RF3-02, T53 (GET /me/faturas, contrato §4.2).
describe('FaturasService.planoEFaturas', () => {
  it('faz GET /me/faturas com o tenant_id pedido e devolve o corpo do §4.2 como veio', async () => {
    mockGet.mockResolvedValue({ data: planoEFaturasDoContrato });
    const resultado: PlanoEFaturas = await mod.FaturasService.planoEFaturas('t1');
    expect(mockGet).toHaveBeenLastCalledWith('/me/faturas?tenant_id=t1');
    expect(resultado).toEqual(planoEFaturasDoContrato);
  });

  it('codifica o tenant_id na URL', async () => {
    mockGet.mockResolvedValue({ data: planoEFaturasDoContrato });
    await mod.FaturasService.planoEFaturas('a b&c');
    expect(mockGet).toHaveBeenLastCalledWith('/me/faturas?tenant_id=a%20b%26c');
  });

  it('erro da API chega a quem chamou (a tela mostra o erro)', async () => {
    const falha = new Error('Network Error');
    mockGet.mockRejectedValue(falha);
    await expect(mod.FaturasService.planoEFaturas('t1')).rejects.toBe(falha);
  });
});

// spec: cobranca-e-plano-do-cliente RF4-04, T71 (campo reativacao do resumo, §4.1).
describe('CobrancaService.resumo em fora_do_ar (fase 4)', () => {
  it('devolve o campo reativacao como veio, com link null ou com o link da cobrança pendente', async () => {
    mockGet.mockResolvedValueOnce({ data: resumoForaDoAr });
    const semCobranca: ResumoDeCobranca = await mod.CobrancaService.resumo('t1');
    expect(semCobranca.reativacao).toEqual({ valor: 39.9, link: null });

    mockGet.mockResolvedValueOnce({ data: resumoForaDoArComReativacaoPendente });
    const comCobranca = await mod.CobrancaService.resumo('t1');
    expect(comCobranca.reativacao).toEqual({ valor: 39.9, link: 'https://www.asaas.com/i/reativ1' });
  });
});

// spec: cobranca-e-plano-do-cliente RF4-01, T71 (POST /me/reativacao, §4.3).
describe('ReativacaoService.pedir', () => {
  it('faz POST /me/reativacao com o tenant_id na query, sem corpo, e devolve { valor, vencimento, link }', async () => {
    mockPost.mockResolvedValue({ data: respostaDaReativacao });
    const resultado = await mod.ReativacaoService.pedir('t1');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/me/reativacao?tenant_id=t1');
    expect(resultado).toEqual({ valor: 39.9, vencimento: '2026-12-08', link: 'https://www.asaas.com/i/reativ1' });
  });

  it('codifica o tenant_id na URL', async () => {
    mockPost.mockResolvedValue({ data: respostaDaReativacao });
    await mod.ReativacaoService.pedir('a b&c');
    expect(mockPost).toHaveBeenLastCalledWith('/me/reativacao?tenant_id=a%20b%26c');
  });

  it('409 nao_pausada_por_cobranca vira { tipo: "nao_pausada" }', async () => {
    mockPost.mockRejectedValue({ response: { status: 409, data: { error: 'nao_pausada_por_cobranca' } } });
    await expect(mod.ReativacaoService.pedir('t1')).resolves.toEqual({ tipo: 'nao_pausada' });
  });

  it('409 cancellation_requested vira { tipo: "cancelamento_pedido" }', async () => {
    mockPost.mockRejectedValue({ response: { status: 409, data: { error: 'cancellation_requested' } } });
    await expect(mod.ReativacaoService.pedir('t1')).resolves.toEqual({ tipo: 'cancelamento_pedido' });
  });

  it('outros erros são lançados para a tela: 502, 500, 403 e 409 com outro código', async () => {
    for (const falha of [
      { response: { status: 502, data: { error: 'asaas_unavailable' } } },
      { response: { status: 500, data: { error: 'internal_error' } } },
      { response: { status: 403, data: { error: 'forbidden', permissao: 'portal.contrato.cancelar' } } },
      { response: { status: 409, data: { error: 'outro' } } },
      new Error('Network Error'),
    ]) {
      mockPost.mockRejectedValueOnce(falha);
      await expect(mod.ReativacaoService.pedir('t1')).rejects.toBe(falha);
    }
  });
});
