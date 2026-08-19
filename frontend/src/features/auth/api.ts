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

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/users/me/');
  return data;
}

export type UpdateUserPayload = Partial<Pick<User, 'first_name' | 'last_name' | 'email'>>;

export async function updateCurrentUser(payload: UpdateUserPayload): Promise<User> {
  const { data } = await apiClient.patch<User>('/auth/users/me/', payload);
  return data;
}
