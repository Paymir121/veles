import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { fetchCurrentUser, loginUser } from './api';
import { useAuthStore } from './useAuthStore';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const setUser = useAuthStore((state) => state.setUser);

  const mutation = useMutation({
    mutationFn: async () => {
      const tokens = await loginUser({ username, password });
      login(tokens);
      try {
        const user = await fetchCurrentUser();
        setUser(user);
      } catch {
        setUser(null);
      }
    },
    onSuccess: () => {
      const state = location.state as LocationState | null;
      const redirectTo = state?.from?.pathname ?? '/tree';
      navigate(redirectTo, { replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-bg-muted p-4 overflow-y-auto">
      <form className="card w-full max-w-sm flex flex-col gap-1" onSubmit={handleSubmit}>
        <h1 className="text-2xl font-bold text-center text-accent-secondary">
          <Link to="/" className="no-underline text-accent-secondary">Велес</Link>
        </h1>
        <p className="text-text-muted text-center mb-6">Вход в семейное дерево</p>

        <label className="field-label mb-3">
          Имя пользователя
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="field-label mb-3">
          Пароль
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {mutation.isError && (
          <div className="rounded-lg bg-error/10 text-error text-sm px-3 py-2 mb-2">
            Не удалось войти. Проверьте имя пользователя и пароль.
          </div>
        )}

        <button type="submit" className="btn w-full mt-2" disabled={mutation.isPending}>
          {mutation.isPending ? 'Вход...' : 'Войти'}
        </button>

        <p className="text-center text-sm text-text-muted mt-4">
          Нет аккаунта? <Link to="/register" className="text-accent font-medium hover:underline">Зарегистрироваться</Link>
        </p>
        <p className="text-center text-sm text-text-muted mt-2">
          <Link to="/tree" className="text-accent font-medium hover:underline">К дереву без входа</Link>
        </p>
      </form>
    </div>
  );
}
