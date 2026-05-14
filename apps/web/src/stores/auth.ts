import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SafeUser } from '@kiroportal/types';

interface AuthState {
  user: SafeUser | null;
  accessToken: string | null;
}

interface AuthActions {
  login: (user: SafeUser, accessToken: string) => void;
  logout: () => void;
  setUser: (user: SafeUser) => void;
  setAccessToken: (token: string) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,

      login: (user, accessToken) => {
        set({ user, accessToken });
        // Also store token in localStorage for the API client
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', accessToken);
        }
      },

      logout: () => {
        set({ user: null, accessToken: null });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
        }
      },

      setUser: (user) => set({ user }),

      setAccessToken: (accessToken) => {
        set({ accessToken });
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', accessToken);
        }
      },
    }),
    {
      name: 'kiroportal-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    },
  ),
);
