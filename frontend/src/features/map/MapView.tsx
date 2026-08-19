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
      return `<li><a href="/person/${person.id}">${name}</a></li>`;
    })
    .join('');
  return `<ul class="map-balloon-persons">${items}</ul>`;
}

export function MapView({ onMapInstanceReady }: MapViewProps) {
  const { data: burialPlaces = [], isLoading, isError } = useBurialPlaces();

  if (!hasYandexMapsApiKey()) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center text-text-muted">
        <p>
          Не задан ключ Яндекс.Карт (<code className="bg-bg-muted px-1 rounded">VITE_YANDEX_MAPS_API_KEY</code>). Получите бесплатный
          ключ на{' '}
          <a href="https://yandex.com/dev/maps" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            yandex.com/dev/maps
          </a>{' '}
          и укажите его в <code className="bg-bg-muted px-1 rounded">.env</code>.
        </p>
      </div>
    );
  }

  if (isLoading) return <p className="text-text-muted p-6">Загрузка карты...</p>;
  if (isError) return <p className="text-error p-6">Не удалось загрузить места захоронения.</p>;

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
