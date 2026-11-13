import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.hoisted(() => vi.fn());
const mockPut = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      put: mockPut,
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    })),
  },
}));

vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ session: null, logout: vi.fn() }) } }));
vi.mock('@/lib/pkce', () => ({ redirectToHostedUI: vi.fn() }));

let mod: typeof import('./meusDados');

beforeAll(async () => {
  mod = await import('./meusDados');
});

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockReset();
});

describe('mapearErroDoNegocio', () => {
  it('400 vira erro de campo', () => {
    expect(mod.mapearErroDoNegocio({
      response: { status: 400, data: { erro: 'campo_invalido', campo: 'cep', motivo: 'informe um CEP válido' } },
    })).toEqual({ tipo: 'campo', campo: 'cep', detalhe: 'informe um CEP válido' });
  });

  it('422 vira recusa do Asaas com o detalhe', () => {
    expect(mod.mapearErroDoNegocio({
      response: { status: 422, data: { erro: 'asaas_recusou', detalhe: '<b>x</b>' } },
    })).toEqual({ tipo: 'asaas', detalhe: '<b>x</b>' });
  });

  it('503 vira indisponível', () => {
    expect(mod.mapearErroDoNegocio({ response: { status: 503, data: { erro: 'asaas_indisponivel' } } })).toEqual({ tipo: 'indisponivel' });
  });
});

describe('NegocioService', () => {
  it('lê com a empresa na query e no cabeçalho', async () => {
    mockGet.mockResolvedValue({ data: { nome_negocio: '828' } });
    await mod.NegocioService.ler('t 1');
    expect(mockGet).toHaveBeenCalledWith('/me/negocio?tenant_id=t%201', { headers: { 'X-Tenant-ID': 't 1' } });
  });

  it('salvar 422 lança o erro mapeado e não o axios', async () => {
    mockPut.mockRejectedValue({ response: { status: 422, data: { detalhe: 'CEP inválido' } } });
    await expect(mod.NegocioService.salvar('t1', { nome_negocio: '828' })).rejects.toEqual({ tipo: 'asaas', detalhe: 'CEP inválido' });
  });
});
