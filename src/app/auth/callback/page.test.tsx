import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AuthCallbackPage from './page';
import { useRouter, useSearchParams } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '@/store/authStore';
import { exchangeCodeForTokens, redirectToHostedUI } from '@/lib/pkce';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/lib/pkce', () => ({
  exchangeCodeForTokens: vi.fn(),
  redirectToHostedUI: vi.fn(),
  PKCE_VERIFIER_STORAGE_KEY: 'pkce_code_verifier',
  AUTH_RETURN_TO_STORAGE_KEY: 'auth_return_to',
}));

describe('AuthCallbackPage (TASK-FE-CUST-003)', () => {
  const mockPush = vi.fn();
  const mockSetSession = vi.fn();

  const makeSearchParams = (code: string | null) => ({
    get: (key: string) => (key === 'code' ? code : null),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    (useRouter as any).mockReturnValue({ push: mockPush });
    (useAuthStore as any).mockImplementation((selector: any) =>
      selector({ setSession: mockSetSession })
    );
    (jwtDecode as any).mockReturnValue({
      email: 'customer@example.com',
    });
    (exchangeCodeForTokens as any).mockResolvedValue({
      id_token: 'id-token-xyz',
      access_token: 'access-token-xyz',
      expires_in: 3600,
      token_type: 'Bearer',
    });
  });

  it('exibe erro e não troca código quando o code_verifier não está em sessionStorage', async () => {
    (useSearchParams as any).mockReturnValue(makeSearchParams('auth-code-123'));

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText(/sessão de login inválida ou expirada/i)).toBeInTheDocument();
    });
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('troca code+verifier por tokens, decodifica claims e chama setSession', async () => {
    window.sessionStorage.setItem('pkce_code_verifier', 'verifier-123');
    (useSearchParams as any).mockReturnValue(makeSearchParams('auth-code-123'));

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(exchangeCodeForTokens).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'auth-code-123', codeVerifier: 'verifier-123' })
      );
    });

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith({
        email: 'customer@example.com',
        token: 'id-token-xyz',
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/termos');
    });
  });

  it('consome o code_verifier uma única vez (removido de sessionStorage após a leitura)', async () => {
    window.sessionStorage.setItem('pkce_code_verifier', 'verifier-123');
    (useSearchParams as any).mockReturnValue(makeSearchParams('auth-code-123'));

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(exchangeCodeForTokens).toHaveBeenCalled();
    });
    expect(window.sessionStorage.getItem('pkce_code_verifier')).toBeNull();
  });

  it('redireciona para a rota originalmente pretendida (auth_return_to) após sucesso', async () => {
    window.sessionStorage.setItem('pkce_code_verifier', 'verifier-123');
    window.sessionStorage.setItem('auth_return_to', '/produtos');
    (useSearchParams as any).mockReturnValue(makeSearchParams('auth-code-123'));

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/produtos');
    });
  });

  it('falha na troca de código mostra erro e não chama setSession', async () => {
    window.sessionStorage.setItem('pkce_code_verifier', 'verifier-123');
    (useSearchParams as any).mockReturnValue(makeSearchParams('auth-code-123'));
    (exchangeCodeForTokens as any).mockRejectedValue(new Error('invalid_grant'));

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText(/não foi possível concluir o login/i)).toBeInTheDocument();
    });
    expect(mockSetSession).toHaveBeenCalledWith(null);
  });

  it('botão de "tentar novamente" no erro aciona redirectToHostedUI', async () => {
    (useSearchParams as any).mockReturnValue(makeSearchParams(null));

    render(<AuthCallbackPage />);

    const retryButton = await screen.findByText(/tentar novamente/i);
    retryButton.click();

    expect(redirectToHostedUI).toHaveBeenCalledWith('/termos');
  });
});
