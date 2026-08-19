import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { usePerson, usePersons } from '@/features/persons/hooks';
import {
  DEFAULT_EDGE_STROKE_WIDTH,
  getEdgeStrokeWidth,
  MAX_EDGE_STROKE_WIDTH,
  MIN_EDGE_STROKE_WIDTH,
  setEdgeStrokeWidth,
} from '@/features/tree/treeAppearance';
import { useAuthStore } from './useAuthStore';
import { fetchCurrentUser, setPersonUserLink, updateCurrentUser } from './api';
import { apiClient } from '@/shared/api/client';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [edgeStrokeWidth, setEdgeStrokeWidthState] = useState(getEdgeStrokeWidth);
  const [personQuery, setPersonQuery] = useState('');
  const debouncedPersonQuery = useDebouncedValue(personQuery, 300);
  const linkedPersonId = user?.linked_person_id;
  const { data: linkedPerson } = usePerson(linkedPersonId ?? undefined);
  const { data: personResults = [] } = usePersons(
    debouncedPersonQuery.trim() ? { search: debouncedPersonQuery.trim() } : undefined,
    debouncedPersonQuery.trim().length > 0,
  );

  useEffect(() => {
    fetchCurrentUser().then((u) => {
      setUser(u);
      setFirstName(u.first_name ?? '');
      setLastName(u.last_name ?? '');
      setEmail(u.email ?? '');
    }).catch(() => {});
  }, [setUser]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateCurrentUser({
        first_name: firstName,
        last_name: lastName,
        email: email || undefined,
      });
      setUser(updated);
      setMessage({ type: 'ok', text: 'Изменения сохранены' });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: Record<string, string[]> } })
        ?.response?.data;
      const text = detail
        ? Object.values(detail).flat().join('; ')
        : 'Не удалось сохранить';
      setMessage({ type: 'err', text });
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  async function refreshCurrentUser(successText: string) {
    const refreshed = await fetchCurrentUser();
    setUser(refreshed);
    setMessage({ type: 'ok', text: successText });
    setPersonQuery('');
  }

  async function handleLinkPerson(personId: number) {
    if (!user) return;
    setMessage(null);
    try {
      if (linkedPersonId && linkedPersonId !== personId) {
        await setPersonUserLink(linkedPersonId, null);
      }
      await setPersonUserLink(personId, user.id);
      await refreshCurrentUser('Связанный человек обновлён');
    } catch {
      setMessage({ type: 'err', text: 'Не удалось привязать человека. Попробуйте ещё раз.' });
    }
  }

  async function handleClearLinkedPerson() {
    if (!linkedPersonId) return;
    setMessage(null);
    try {
      await setPersonUserLink(linkedPersonId, null);
      await refreshCurrentUser('Привязка к человеку удалена');
    } catch {
      setMessage({ type: 'err', text: 'Не удалось удалить привязку.' });
    }
  }

  async function handleExport() {
    try {
      const res = await apiClient.get('/export/', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'veles_export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Не удалось выгрузить данные');
    }
  }

  async function handleImport(file: File) {
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await apiClient.post('/import/', form);
      const s = res.data;
      alert(
        `Импорт завершён:\n` +
        `Кладбища: создано ${s.burial_places_created}, обновлено ${s.burial_places_updated}\n` +
        `Персоны: создано ${s.persons_created}, обновлено ${s.persons_updated}\n` +
        `Союзы: создано ${s.unions_created}, обновлено ${s.unions_updated}`,
      );
      window.location.reload();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      const detail = err?.response?.data?.detail || 'Неизвестная ошибка';
      alert(`Ошибка импорта: ${detail}`);
    }
  }

  if (!user) return null;

  const initials = [user.first_name, user.last_name]
    .filter(Boolean)
    .map((s) => s[0].toUpperCase())
    .join('') || user.username[0].toUpperCase();

  return (
    <div className="max-w-lg mx-auto px-4 py-8 sm:py-12 flex flex-col gap-6">
      {/* Header with avatar */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-14 h-14 rounded-full bg-accent text-accent-contrast flex items-center justify-center text-xl font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-text truncate">{user.username}</h1>
          <p className="text-sm text-text-muted">
            {[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Настройте своё имя'}
          </p>
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="card flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text">Личные данные</h2>

        <label className="field-label">
          Имя пользователя
          <input className="input opacity-60 cursor-not-allowed" value={user.username} disabled />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="field-label">
            Имя
            <input
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Иван"
            />
          </label>
          <label className="field-label">
            Фамилия
            <input
              className="input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Иванов"
            />
          </label>
        </div>

        <label className="field-label">
          Email
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </label>

        {message && (
          <div className={`rounded-lg text-sm px-3 py-2 ${
            message.type === 'ok'
              ? 'bg-accent-secondary/10 text-accent-secondary'
              : 'bg-error/10 text-error'
          }`}>
            {message.text}
          </div>
        )}

        <button type="submit" className="btn w-full" disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить изменения'}
        </button>
      </form>

      <div className="card flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text">Отображение дерева</h2>
        <p className="text-sm text-text-muted -mt-2">
          Толщина линий между людьми. Хранится в этом браузере, на сервер не уходит.
        </p>
        <label className="field-label">
          <span className="flex items-center justify-between gap-3">
            Толщина рёбер
            <span className="tabular-nums text-text font-medium">{edgeStrokeWidth.toFixed(1)}</span>
          </span>
          <input
            className="range-input"
            type="range"
            min={MIN_EDGE_STROKE_WIDTH}
            max={MAX_EDGE_STROKE_WIDTH}
            step={0.1}
            value={edgeStrokeWidth}
            aria-valuemin={MIN_EDGE_STROKE_WIDTH}
            aria-valuemax={MAX_EDGE_STROKE_WIDTH}
            aria-valuenow={edgeStrokeWidth}
            onChange={(e) => {
              setEdgeStrokeWidthState(setEdgeStrokeWidth(Number(e.target.value)));
            }}
          />
        </label>
        <button
          type="button"
          className="btn-secondary btn self-start"
          disabled={edgeStrokeWidth === DEFAULT_EDGE_STROKE_WIDTH}
          onClick={() => setEdgeStrokeWidthState(setEdgeStrokeWidth(DEFAULT_EDGE_STROKE_WIDTH))}
        >
          Сбросить
        </button>
      </div>

      <div className="card flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text">Кто вы в дереве</h2>
        {linkedPerson ? (
          <div className="rounded-lg border border-border bg-bg px-4 py-3">
            <p className="text-sm text-text-muted mb-2">Сейчас привязан человек:</p>
            <p className="font-medium">
              {[linkedPerson.last_name, linkedPerson.first_name, linkedPerson.patronymic].filter(Boolean).join(' ')}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" className="btn-secondary btn" onClick={handleClearLinkedPerson}>
                Убрать привязку
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            Выберите свою карточку, чтобы дерево открывалось сразу на вас.
          </p>
        )}

        <label className="field-label">
          Найти себя в дереве
          <input
            className="input"
            value={personQuery}
            onChange={(e) => setPersonQuery(e.target.value)}
            placeholder="Фамилия, имя..."
          />
        </label>

        {debouncedPersonQuery.trim() && (
          <div className="picker-results">
            {personResults.length > 0 ? personResults.map((person) => (
              <button key={person.id} type="button" onClick={() => void handleLinkPerson(person.id)}>
                {[person.last_name, person.first_name, person.patronymic].filter(Boolean).join(' ')}
              </button>
            )) : (
              <div className="px-3 py-2 text-sm text-text-muted">Ничего не найдено.</div>
            )}
          </div>
        )}
      </div>

      {/* Data management */}
      <div className="card flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text">Управление данными</h2>
        <p className="text-sm text-text-muted -mt-2">
          Экспорт и импорт всех данных генеалогического дерева в формате JSON
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" className="btn-secondary btn" onClick={handleExport}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Выгрузить
          </button>
          <button
            type="button"
            className="btn-secondary btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Импорт
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = '';
          }}
        />
      </div>

      {/* Logout */}
      <button type="button" className="btn-ghost text-sm text-error w-full" onClick={handleLogout}>
        Выйти из аккаунта
      </button>
    </div>
  );
}
