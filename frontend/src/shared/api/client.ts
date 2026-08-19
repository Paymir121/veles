import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
// Deliberate, documented exception to the "features don't import each other"
// rule: the HTTP client needs to read the current access token and trigger
// logout-on-refresh-failure, and auth is the one cross-cutting concern the
// whole app depends on. Every other feature must NOT reach into another
// feature like this - only shared/ is allowed to depend on features/auth.
import { useAuthStore } from '@/features/auth/useAuthStore';

// Always a RELATIVE path. Never point this at an absolute backend origin:
// in dev, vite.config.ts proxies /api -> the Django dev server; in
// production, nginx does the equivalent proxying under one origin. This is
// what makes CORS a non-issue for this app.
export const apiClient = axios.create({
  baseURL: '/api',
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Access tokens live 30 minutes (see backend SIMPLE_JWT settings). Multiple
// requests can 401 around the same time when a token expires; this makes
// sure they all await the SAME in-flight refresh instead of each firing
// their own POST /api/auth/jwt/refresh/.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshTokenValue = useAuthStore.getState().refreshToken;
  if (!refreshTokenValue) {
    throw new Error('No refresh token available');
  }
  // Plain axios, NOT apiClient - we don't want the request interceptor
  // attaching a (stale/expired) Authorization header to this call.
  const { data } = await axios.post<{ access: string }>('/api/auth/jwt/refresh/', {
    refresh: refreshTokenValue,
  });
  useAuthStore.getState().setAccessToken(data.access);
  return data.access;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    const isUnauthorized = error.response?.status === 401;
    const alreadyRetried = originalRequest?._retry;
    const isRefreshCall = originalRequest?.url?.includes('/auth/jwt/refresh/');

    if (isUnauthorized && originalRequest && !alreadyRetried && !isRefreshCall) {
      originalRequest._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const newAccessToken = await refreshPromise;
        originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
        return apiClient(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
