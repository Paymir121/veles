import { Clusterer, Map, Placemark, YMaps } from '@pbe/react-yandex-maps';
import type { BurialPlace } from '@/shared/types';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  hasYandexMapsApiKey,
  yandexMapsQuery,
  type YandexMapInstance,
} from '@/shared/maps/yandexMapsSetup';
import { escapeHtmlForBalloon } from './escapeHtmlForBalloon';
import { useBurialPlaces } from './hooks';

interface MapViewProps {
  onMapInstanceReady?: (map: YandexMapInstance) => void;
}

function buildBalloonContent(place: BurialPlace): string {
  const persons = place.persons ?? [];
  if (persons.length === 0) {
    return '<p>Нет привязанных записей.</p>';
  }
  const items = persons
    .map((person) => {
      const name = escapeHtmlForBalloon(
        [person.last_name, person.first_name, person.patronymic].filter(Boolean).join(' '),
      );
      // Plain anchor navigation (full page load), not client-side routing:
      // Yandex's native balloon renders raw HTML outside React's tree, so
      // there's no clean way to hook React Router's <Link> into it without
      // significantly more integration work. Acceptable trade-off for a
      // small non-commercial app - documented here rather than silently
      // assumed.
      return `<li><a href="/person/${person.id}">${name}</a></li>`;
    })
    .join('');
  return `<ul class="map-balloon-persons">${items}</ul>`;
}

// Renders one <Placemark> per BurialPlace (clustered), each balloon listing
// the people buried there with links to /person/:id. If the API key is
// missing, this renders an explanatory message instead of ever touching the
// Yandex SDK - the app can't function without a real key, but it shouldn't
// crash in dev before one is registered.
export function MapView({ onMapInstanceReady }: MapViewProps) {
  const { data: burialPlaces = [], isLoading, isError } = useBurialPlaces();

  if (!hasYandexMapsApiKey()) {
    return (
      <div className="map-missing-key">
        <p>
          Не задан ключ Яндекс.Карт (<code>VITE_YANDEX_MAPS_API_KEY</code>). Получите бесплатный
          ключ на{' '}
          <a href="https://yandex.com/dev/maps" target="_blank" rel="noreferrer">
            yandex.com/dev/maps
          </a>{' '}
          и укажите его в <code>.env</code>.
        </p>
      </div>
    );
  }

  if (isLoading) return <p>Загрузка карты...</p>;
  if (isError) return <p>Не удалось загрузить места захоронения.</p>;

  const placeableLocations = burialPlaces.filter(
    (place): place is BurialPlace & { latitude: number; longitude: number } =>
      place.latitude !== null && place.longitude !== null,
  );

  return (
    <YMaps query={yandexMapsQuery}>
      <Map
        defaultState={{ center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM }}
        width="100%"
        height="100%"
        instanceRef={(instance: unknown) => {
          if (instance && onMapInstanceReady) {
            onMapInstanceReady(instance as YandexMapInstance);
          }
        }}
      >
        <Clusterer options={{ preset: 'islands#invertedVioletClusterIcons' }}>
          {placeableLocations.map((place) => (
            <Placemark
              key={place.id}
              geometry={[place.latitude, place.longitude]}
              properties={{
                hintContent: `${place.name}${place.city ? ` (${place.city})` : ''}`,
                balloonContentHeader: escapeHtmlForBalloon(place.name),
                balloonContentBody: buildBalloonContent(place),
              }}
              options={{ preset: 'islands#violetIcon' }}
            />
          ))}
        </Clusterer>
      </Map>
    </YMaps>
  );
}
