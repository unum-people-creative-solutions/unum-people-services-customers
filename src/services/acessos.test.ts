import { vi, describe, it, expect, beforeAll } from 'vitest';
import type { MeusAcessos } from './api';

// spec: gestao-de-acesso-f4-aplicacao RF-08 (leitura de /me/acessos da empresa ativa).

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

let mod: typeof import('./api');

beforeAll(async () => {
  mod = await import('./api');
});

const acessos: MeusAcessos = {
  tenant_id: 'TENANT#DEMO_REVIEW',
  operador: false,
  ferramentas: [
    { id: 'crm', nome: 'CRM', contratada: true, papel: { id: 'sem_acesso', nome: 'Sem acesso', sistema: true, implicito: false }, permissoes: [] },
  ],
};

describe('AcessosService.get', () => {
  it('faz GET /me/acessos da empresa ativa, com o id codificado, e devolve o corpo', async () => {
    mockGet.mockResolvedValue({ data: acessos });
    const resultado: MeusAcessos = await mod.AcessosService.get('TENANT#DEMO_REVIEW');
    expect(mockGet).toHaveBeenCalledWith('/me/acessos?tenant_id=TENANT%23DEMO_REVIEW');
    expect(resultado).toEqual(acessos);
  });

  it('sem empresa ativa, deixa a API resolver pela conta do token', async () => {
    mockGet.mockResolvedValue({ data: acessos });
    await mod.AcessosService.get(undefined);
    expect(mockGet).toHaveBeenLastCalledWith('/me/acessos');
  });
});
