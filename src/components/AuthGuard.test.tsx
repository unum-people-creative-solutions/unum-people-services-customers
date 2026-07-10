import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AuthGuard from './AuthGuard';
import { useAuthStore } from '@/store/authStore';
import { usePathname } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { redirectToHostedUI } from '@/lib/pkce';

// Mocks
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(vi.fn(), {
    persist: {
      onFinishHydration: vi.fn(),
      hasHydrated: vi.fn(),
    },
  }),
}));

vi.mock('@/lib/pkce', () => ({
  redirectToHostedUI: vi.fn(async () => {}),
}));

describe('AuthGuard', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (usePathname as any).mockReturnValue('/termos');

    // Mock default persist behavior (already hydrated)
    (useAuthStore.persist.hasHydrated as any).mockReturnValue(true);
    (useAuthStore.persist.onFinishHydration as any).mockReturnValue(() => {});

    // Mock default jwt-decode behavior (valid token)
    (jwtDecode as any).mockReturnValue({ exp: Date.now() / 1000 + 10000 });
    
    // Default store state
    (useAuthStore as any).mockReturnValue({
      isAuthenticated: true,
      session: { token: 'valid-token', email: 'customer@example.com' },
      logout: mockLogout,
    });
  });

  it('deve exibir spinner de carregamento quando não hidratado', () => {
    (useAuthStore.persist.hasHydrated as any).mockReturnValue(false);
    
    render(
      <AuthGuard>
        <div>Content</div>
      </AuthGuard>
    );

    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
  });

  it('deve renderizar children se o usuário estiver autenticado em rota privada', async () => {
    render(
      <AuthGuard>
        <div data-testid="child-content">Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });
  });

  it('deve renderizar children em rotas públicas sem autenticação', async () => {
    (usePathname as any).mockReturnValue('/auth/callback');
    (useAuthStore as any).mockReturnValue({
      isAuthenticated: false,
      session: null,
      logout: mockLogout,
    });

    render(
      <AuthGuard>
        <div data-testid="child-content">Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });
  });

  describe('Redirect para o Hosted UI (Cognito)', () => {
    it('aciona redirectToHostedUI com o pathname atual se não autenticado em rota privada', async () => {
      (usePathname as any).mockReturnValue('/produtos');
      (useAuthStore as any).mockReturnValue({
        isAuthenticated: false,
        session: null,
        logout: mockLogout,
      });

      render(
        <AuthGuard>
          <div>Content</div>
        </AuthGuard>
      );

      await waitFor(() => {
        expect(redirectToHostedUI).toHaveBeenCalledWith('/produtos');
      });
    });

    it('preserva a query string (incluindo return_to) ao redirecionar para o Hosted UI', async () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        search: '?return_to=https://crm.unumpeople.com.br/kanban',
      } as any;

      (usePathname as any).mockReturnValue('/termos');
      (useAuthStore as any).mockReturnValue({
        isAuthenticated: false,
        session: null,
        logout: mockLogout,
      });

      render(
        <AuthGuard>
          <div>Content</div>
        </AuthGuard>
      );

      await waitFor(() => {
        expect(redirectToHostedUI).toHaveBeenCalledWith('/termos?return_to=https://crm.unumpeople.com.br/kanban');
      });

      (window as any).location = originalLocation;
    });

    it('nunca renderiza children em rota privada sem sessão válida', async () => {
      (useAuthStore as any).mockReturnValue({
        isAuthenticated: false,
        session: null,
        logout: mockLogout,
      });

      render(
        <AuthGuard>
          <div data-testid="pagina-privada">Conteúdo Privado</div>
        </AuthGuard>
      );

      expect(screen.queryByTestId('pagina-privada')).not.toBeInTheDocument();
    });

    it('aciona redirectToHostedUI se o token estiver expirado', async () => {
      const expiredTime = Date.now() / 1000 - 1000;
      (jwtDecode as any).mockReturnValue({ exp: expiredTime });

      render(
        <AuthGuard>
          <div>Content</div>
        </AuthGuard>
      );

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(redirectToHostedUI).toHaveBeenCalledWith('/termos');
      });
    });

    it('aciona redirectToHostedUI se a decodificação do token falhar', async () => {
      (jwtDecode as any).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      render(
        <AuthGuard>
          <div>Content</div>
        </AuthGuard>
      );

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(redirectToHostedUI).toHaveBeenCalledWith('/termos');
      });
    });
  });
});
