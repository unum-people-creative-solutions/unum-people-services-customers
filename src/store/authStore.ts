import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserSession {
  email: string;
  token: string;
}

interface AuthState {
  session: UserSession | null;
  nomeSobrescrito: string | null;
  isAuthenticated: boolean;
  setSession: (session: UserSession | null) => void;
  atualizarNome: (nome: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      nomeSobrescrito: null,
      isAuthenticated: false,
      setSession: (session) => set({ session, isAuthenticated: !!session, nomeSobrescrito: null }),
      atualizarNome: (nome) => set({ nomeSobrescrito: nome }),
      logout: () => set({ session: null, isAuthenticated: false, nomeSobrescrito: null }),
    }),
    {
      name: 'auth-storage-customers',
    }
  )
);
