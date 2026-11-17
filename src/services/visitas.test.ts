import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RespostaDeVisitas, VisitasDoPeriodo } from '@/types/visitas';
import dados30 from './__fixtures__/visitas/me-visitas-30.json';
import dados7Vazio from './__fixtures__/visitas/me-visitas-7-vazio.json';
import dadosBloqueado from './__fixtures__/visitas/me-visitas-bloqueado.json';
import dados404 from './__fixtures__/visitas/me-visitas-404.json';

// spec: metricas-de-visitas §3.4, §3.9, T60 (TASK-PORTAL-501). Os quatro JSON são cópias
// byte a byte de internal/handler/testdata/visitas/ da API.

vi.mock('@/store/authStore', () => ({
  useAuthStore: { getState: () => ({ session: { token: 'token-da-sessao' }, logout: vi.fn() }) },
}));
vi.mock('@/lib/pkce', () => ({ redirectToHostedUI: vi.fn() }));

// Um JSON importado chega com os literais alargados (true → boolean, 30 → number). A
// conferência de tipo é nos dois sentidos, sem `as`: mesma forma, nenhuma chave a mais
// ou a menos.
type Alargado<T> = T extends boolean
  ? boolean
  : T extends number
    ? number
    : T extends string
      ? string
      : T extends (infer U)[]
        ? Alargado<U>[]
        : T extends object
          ? { [K in keyof T]: Alargado<T[K]> }
          : T;
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const formaDos30: Igual<typeof dados30, Alargado<VisitasDoPeriodo>> = true;
const formaDos7: Igual<typeof dados7Vazio, Alargado<VisitasDoPeriodo>> = true;
const formaDoBloqueado: Igual<typeof dadosBloqueado, Alargado<Extract<RespostaDeVisitas, { disponivel: false }>>> = true;

type Resposta = { status: number; data: unknown };

let mod: typeof import('./visitas');
let api: typeof import('./api').default;
let pedidos: InternalAxiosRequestConfig[];

// O adaptador fica no lugar da rede: o interceptor real do api.ts roda antes dele.
function responder(resposta: Resposta) {
  pedidos = [];
  api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    pedidos.push(config);
    const res: AxiosResponse = { data: resposta.data, status: resposta.status, statusText: '', headers: {}, config };
    if (resposta.status >= 400) {
      throw new AxiosError('falha', AxiosError.ERR_BAD_REQUEST, config, null, res);
    }
    return res;
  };
}

beforeAll(async () => {
  mod = await import('./visitas');
  api = (await import('./api')).default;
});

afterEach(() => {
  api.defaults.adapter = undefined;
});

describe('VisitasService.ler (T60)', () => {
  it('os três corpos 200 têm a forma exata de RespostaDeVisitas', () => {
    expect([formaDos30, formaDos7, formaDoBloqueado]).toEqual([true, true, true]);
  });

  it('pede GET /me/visitas?periodo=30&tenant_id=t1 com o Authorization da sessão e devolve me-visitas-30.json', async () => {
    responder({ status: 200, data: dados30 });
    const leitura = await mod.VisitasService.ler('t1', 30);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].method).toBe('get');
    expect(pedidos[0].url).toBe('/me/visitas?periodo=30&tenant_id=t1');
    expect(pedidos[0].headers.Authorization).toBe('token-da-sessao');
    expect(leitura).toEqual(dados30);
  });

  it('codifica o tenant_id da empresa ativa (# vira %23)', async () => {
    responder({ status: 200, data: dados7Vazio });
    const leitura = await mod.VisitasService.ler('TENANT#abc', 7);
    expect(pedidos[0].url).toBe('/me/visitas?periodo=7&tenant_id=TENANT%23abc');
    expect(leitura).toEqual(dados7Vazio);
  });

  it('200 fora do plano devolve { disponivel: false }', async () => {
    responder({ status: 200, data: dadosBloqueado });
    await expect(mod.VisitasService.ler('t1', 90)).resolves.toEqual({ disponivel: false });
    expect(pedidos[0].url).toBe('/me/visitas?periodo=90&tenant_id=t1');
  });

  it('404 com me-visitas-404.json vira { inexistente: true }', async () => {
    responder({ status: 404, data: dados404 });
    await expect(mod.VisitasService.ler('t1', 30)).resolves.toEqual({ inexistente: true });
  });

  it('500 é lançado', async () => {
    responder({ status: 500, data: { error: 'internal_error' } });
    await expect(mod.VisitasService.ler('t1', 30)).rejects.toMatchObject({ response: { status: 500 } });
  });

  it('403 com permissao é lançado (a tela mostra a mensagem de permissão)', async () => {
    responder({ status: 403, data: { error: 'forbidden', permissao: 'portal.empresa.ver' } });
    await expect(mod.VisitasService.ler('t1', 30)).rejects.toMatchObject({
      response: { status: 403, data: { permissao: 'portal.empresa.ver' } },
    });
  });
});
