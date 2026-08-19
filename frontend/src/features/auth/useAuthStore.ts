import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/shared/types';

interface JwtPair {
  access: string;
  refresh: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (tokens: JwtPair) => void;
  setAccessToken: (access: string) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
}

// The one piece of client-side state that matters, per the architecture
// plan: JWT tokens + the current user. Persisted to localStorage - a
// deliberate, already-decided tradeoff (simplicity over httpOnly-cookie
// complexity for a small non-commercial app), not something to second-guess.
// zustand's `persist` middleware handles both writing on every change and
// rehydrating synchronously from localStorage on load, so no extra
// bootstrap code is needed elsewhere.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      login: (tokens) =>
        set({
          accessToken: tokens.access,
          refreshToken: tokens.refresh,
          isAuthenticated: true,
        }),

      setAccessToken: (access) => set({ accessToken: access }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'veles-auth',
    },
  ),
);
