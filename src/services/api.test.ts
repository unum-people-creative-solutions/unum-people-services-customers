import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';

const mockRequestInterceptors = vi.hoisted(() => ({
  use: vi.fn(),
  callback: null as any,
}));

const mockResponseInterceptors = vi.hoisted(() => ({
  success: null as any,
  error: null as any,
}));

vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn().mockImplementation(() => {
        return {
          interceptors: {
            request: {
              use: vi.fn((callback) => {
                mockRequestInterceptors.callback = callback;
              }),
            },
            response: {
              use: vi.fn((success, error) => {
                mockResponseInterceptors.success = success;
                mockResponseInterceptors.error = error;
              }),
            },
          },
        };
      }),
    },
  };
});

const mockLogout = vi.fn();
const mockGetState = vi.fn(() => ({
  session: { token: 'my-token' },
  logout: mockLogout,
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: () => mockGetState(),
  },
}));

vi.mock('@/lib/pkce', () => ({
  redirectToHostedUI: vi.fn(),
}));

import { redirectToHostedUI } from '@/lib/pkce';

let api: any;

beforeAll(async () => {
  api = (await import('./api')).default;
});

describe('API Interceptors', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      href: 'http://localhost/termos',
      pathname: '/termos',
    } as any;
  });

  afterEach(() => {
    delete (window as any).location;
    window.location = originalLocation as any;
  });

  describe('Request Interceptor', () => {
    it('deve injetar o token de Authorization se o token estiver presente na sessao', () => {
      mockGetState.mockReturnValue({
        session: { token: 'token-123' },
        logout: mockLogout,
      } as any);

      const config = { headers: {} } as any;
      const result = mockRequestInterceptors.callback(config);

      expect(result.headers.Authorization).toBe('token-123');
    });

    it('nao deve injetar Authorization se nao houver token na sessao', () => {
      mockGetState.mockReturnValue({
        session: null,
        logout: mockLogout,
      } as any);

      const config = { headers: {} } as any;
      const result = mockRequestInterceptors.callback(config);

      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor', () => {
    it('deve retornar a resposta se o status for de sucesso', () => {
      const response = { status: 200, data: 'ok' };
      const result = mockResponseInterceptors.success(response);
      expect(result).toBe(response);
    });

    it('deve rejeitar outros erros e nao fazer nada se nao for 401', async () => {
      const mockError = { response: { status: 500 } };
      await expect(mockResponseInterceptors.error(mockError)).rejects.toEqual(mockError);
      expect(mockLogout).not.toHaveBeenCalled();
      expect(redirectToHostedUI).not.toHaveBeenCalled();
    });

    it('deve deslogar e redirecionar para Hosted UI quando status for 401', async () => {
      const mockError = { response: { status: 401 } };
      mockGetState.mockReturnValue({
        session: { token: 'my-token' },
        logout: mockLogout,
      } as any);

      await expect(mockResponseInterceptors.error(mockError)).rejects.toEqual(mockError);
      expect(mockLogout).toHaveBeenCalled();
      expect(redirectToHostedUI).toHaveBeenCalledWith('/termos');
    });
  });
});
