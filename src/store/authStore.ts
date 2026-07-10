import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserSession {
  email: string;
  token: string;
}

interface AuthState {
  session: UserSession | null;
  isAuthenticated: boolean;
  setSession: (session: UserSession | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      isAuthenticated: false,
      setSession: (session) => set({ session, isAuthenticated: !!session }),
      logout: () => set({ session: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage-customers',
    }
  )
);
