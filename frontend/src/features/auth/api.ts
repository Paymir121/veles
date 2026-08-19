import { apiClient } from '@/shared/api/client';
import type { User } from '@/shared/types';

export interface RegisterPayload {
  username: string;
  password: string;
  re_password: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface JwtPair {
  access: string;
  refresh: string;
}

// Djoser registration endpoint - AllowAny on the backend.
export async function registerUser(payload: RegisterPayload): Promise<void> {
  await apiClient.post('/auth/users/', payload);
}

// SimpleJWT login.
export async function loginUser(payload: LoginPayload): Promise<JwtPair> {
  const { data } = await apiClient.post<JwtPair>('/auth/jwt/create/', payload);
  return data;
}

// SimpleJWT refresh. Note: shared/api/client.ts calls the raw endpoint
// directly (via plain axios) for its interceptor logic - this export is for
// any explicit/manual refresh call sites, kept here so features/auth owns
// every auth endpoint.
export async function refreshAccessToken(refresh: string): Promise<{ access: string }> {
  const { data } = await apiClient.post<{ access: string }>('/auth/jwt/refresh/', { refresh });
  return data;
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/users/me/');
  return data;
}
