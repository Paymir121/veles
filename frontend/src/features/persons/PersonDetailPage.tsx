import { Map as YandexMapComponent, Placemark, YMaps } from '@pbe/react-yandex-maps';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/useAuthStore';
import type { PersonSummary } from '@/shared/types';
import {
  FOCUSED_MAP_ZOOM,
  hasYandexMapsApiKey,
  yandexMapsQuery,
} from '@/shared/maps/yandexMapsSetup';
import { escapeHtml } from '@/shared/utils/escapeHtml';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import { useBurialPlace, useDeletePerson, usePerson } from './hooks';

const GENDER_LABELS: Record<string, string> = {
  M: 'Мужской',
  F: 'Женский',
  U: 'Не указан',
};

export function PersonDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const navigate = useNavigate();

  const { data: person, isLoading, isError } = usePerson(id);
  const { data: father } = usePerson(person?.father ?? undefined);
  const { data: mother } = usePerson(person?.mother ?? undefined);
  const { data: burialPlace } = useBurialPlace(person?.burial_place ?? undefined);
  const deleteMutation = useDeletePerson();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  function handleDelete() {
    if (!person) return;
    const confirmed = window.confirm(
      `Удалить ${person.last_name} ${person.first_name}? Это действие необратимо.`,
    );
    if (!confirmed) return;
    deleteMutation.mutate(person.id, {
      onSuccess: () => navigate('/tree', { replace: true }),
    });
  }

  if (isLoading) return <p className="text-text-muted p-8">Загрузка...</p>;
  if (isError || !person) return <p className="text-error p-8">Не удалось загрузить данные человека.</p>;

  const fullName = [person.last_name, person.first_name, person.patronymic]
    .filter(Boolean)
    .join(' ');

  function renderRelationList(title: string, people: PersonSummary[]) {
    if (people.length === 0) return null;
    return (
      <div className="card mb-4">
        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        <ul className="space-y-2">
          {people.map((relative) => (
            <li key={relative.id}>
              <Link to={`/person/${relative.id}`} className="text-accent hover:underline">
                {[relative.last_name, relative.first_name, relative.patronymic].filter(Boolean).join(' ')}
              </Link>
              {(relative.birth_date || relative.death_date) && (
                <span className="text-text-muted ml-2 text-xs">
                  {formatDisplayDate(relative.birth_date) || relative.birth_date || '?'}
                  {relative.death_date ? ` — ${formatDisplayDate(relative.death_date) || relative.death_date}` : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="max-w-3xl w-full">
      {/* Header card: photo, name, status & action buttons */}
      <div className="card mb-4">
        <div className="flex items-start gap-5">
          {person.photo ? (
            <img src={person.photo} alt={fullName} className="w-28 h-28 rounded-xl object-cover shadow-sm shrink-0" />
          ) : (
            <div className="w-28 h-28 rounded-xl bg-bg-muted flex items-center justify-center text-text-muted text-3xl font-bold shrink-0">
              {(person.first_name[0] ?? '?').toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold mb-1">{fullName || 'Без имени'}</h1>
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
              person.status === 'alive'
                ? 'bg-accent-secondary/15 text-accent-secondary'
                : 'bg-text-muted/15 text-text-muted'
            }`}>
              {person.status === 'alive' ? 'Жив(а)' : 'Умер(ла)'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-border">
          <Link to={`/tree?person=${person.id}`}>
            <button type="button" className="btn btn-secondary">Показать в дереве</button>
          </Link>
          {isAuthenticated ? (
            <>
              <Link to={`/person/${person.id}/edit`}>
                <button type="button" className="btn">Редактировать</button>
              </Link>
              <button type="button" className="btn-danger btn" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
              </button>
            </>
          ) : (
            <p className="text-sm text-text-muted">
              <Link to="/login" className="text-accent hover:underline">Войдите</Link>, чтобы редактировать.
            </p>
          )}
        </div>
      </div>

      {/* Main info card */}
      <div className="card mb-4">
        <dl className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-text-muted font-medium">Пол</dt>
          <dd>{GENDER_LABELS[person.gender] ?? person.gender}</dd>

          {person.maiden_name && (
            <>
              <dt className="text-text-muted font-medium">Девичья фамилия</dt>
              <dd>{person.maiden_name}</dd>
            </>
          )}

          <dt className="text-text-muted font-medium">Дата рождения</dt>
          <dd>{formatDisplayDate(person.birth_date) || person.birth_date_text || '—'}</dd>

          {person.birth_place && (
            <>
              <dt className="text-text-muted font-medium">Место рождения</dt>
              <dd>{person.birth_place}</dd>
            </>
          )}

          {person.status === 'deceased' && (
            <>
              <dt className="text-text-muted font-medium">Дата смерти</dt>
              <dd>{formatDisplayDate(person.death_date) || person.death_date_text || '—'}</dd>

              <dt className="text-text-muted font-medium">Место захоронения</dt>
              <dd>
                {burialPlace ? (
                  <>
                    {burialPlace.name} {burialPlace.city && `(${burialPlace.city})`}
                  </>
                ) : (
                  '—'
                )}
              </dd>

              {person.burial_plot_details && (
                <>
                  <dt className="text-text-muted font-medium">Детали участка</dt>
                  <dd>{person.burial_plot_details}</dd>
                </>
              )}
            </>
          )}

          <dt className="text-text-muted font-medium">Отец</dt>
          <dd>
            {father ? (
              <Link to={`/person/${father.id}`} className="text-accent hover:underline">
                {father.last_name} {father.first_name}
              </Link>
            ) : (
              '—'
            )}
          </dd>

          <dt className="text-text-muted font-medium">Мать</dt>
          <dd>
            {mother ? (
              <Link to={`/person/${mother.id}`} className="text-accent hover:underline">
                {mother.last_name} {mother.first_name}
              </Link>
            ) : (
              '—'
            )}
          </dd>
        </dl>
      </div>

      {renderRelationList('Супруг(а)', person.spouses ?? [])}

      {renderRelationList('Дети', person.children)}

      {renderRelationList('Братья и сёстры', person.siblings)}

      {/* Burial mini-map */}
      {person.status === 'deceased' &&
        burialPlace &&
        burialPlace.latitude != null &&
        burialPlace.longitude != null &&
        hasYandexMapsApiKey() && (
          <div className="card mb-4">
            <h2 className="text-lg font-semibold mb-3">Место захоронения на карте</h2>
            <div className="rounded-lg overflow-hidden" style={{ height: 250 }}>
              <YMaps query={yandexMapsQuery}>
                <YandexMapComponent
                  defaultState={{
                    center: [burialPlace.latitude, burialPlace.longitude],
                    zoom: FOCUSED_MAP_ZOOM,
                  }}
                  width="100%"
                  height="100%"
                  modules={['control.ZoomControl']}
                >
                  <Placemark
                    geometry={[burialPlace.latitude, burialPlace.longitude]}
                    modules={['geoObject.addon.balloon', 'geoObject.addon.hint']}
                    properties={{
                      balloonContentHeader: escapeHtml(burialPlace.name),
                      balloonContentBody: escapeHtml(burialPlace.city || ''),
                      hintContent: escapeHtml(burialPlace.name),
                    }}
                  />
                </YandexMapComponent>
              </YMaps>
            </div>
          </div>
        )}

      {/* Grave photo */}
      {person.status === 'deceased' && person.grave_photo && (
        <div className="card mb-4">
          <h2 className="text-lg font-semibold mb-3">Фото могилы</h2>
          <img src={person.grave_photo} alt="Фото могилы" className="max-w-xs rounded-lg" />
        </div>
      )}

      {/* Extra info */}
      {person.extra_info.length > 0 && (
        <div className="card mb-4">
          <h2 className="text-lg font-semibold mb-3">Дополнительная информация</h2>
          <ul className="space-y-3">
            {person.extra_info.map((item, index) => (
              <li key={index} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="font-medium">
                  <span className="text-accent-secondary">{item.category}</span>: {item.title}
                  {item.role && <span className="text-text-muted"> — {item.role}</span>}
                </div>
                {(item.date_from || item.date_to) && (
                  <span className="text-xs text-text-muted">
                    {item.date_from || '?'} – {item.date_to || '?'}
                  </span>
                )}
                {item.description && <p className="text-sm text-text-muted mt-1">{item.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {person.notes && (
        <div className="card mb-4">
          <h2 className="text-lg font-semibold mb-2">Заметки</h2>
          <p className="text-sm whitespace-pre-wrap">{person.notes}</p>
        </div>
      )}

    </div>
  );
}
