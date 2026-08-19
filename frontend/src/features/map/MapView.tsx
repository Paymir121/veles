// The library's Map component is aliased: unaliased it shadows the global Map
// constructor used for the placemark lookups below.
import { Clusterer, Map as YandexMapComponent, Placemark, YMaps } from '@pbe/react-yandex-maps';
import { useEffect, useMemo, useRef } from 'react';
import type { BurialPlace } from '@/shared/types';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  FOCUSED_MAP_ZOOM,
  hasYandexMapsApiKey,
  openPlacemarkBalloon,
  yandexMapsQuery,
  type YandexClustererInstance,
  type YandexMapInstance,
  type YandexPlacemarkInstance,
} from '@/shared/maps/yandexMapsSetup';
import { escapeHtmlForBalloon } from './escapeHtmlForBalloon';
import { useBurialPlaces } from './hooks';
import type { MapFocusRequest } from './types';

interface MapViewProps {
  /** Place to fly to and open the balloon of. Carries a token so selecting the
   *  same place twice in a row still re-focuses it. */
  focus?: MapFocusRequest | null;
}

interface PlaceableBurialPlace extends BurialPlace {
  latitude: number;
  longitude: number;
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

export function MapView({ focus }: MapViewProps) {
  const { data: burialPlaces = [], isLoading, isError } = useBurialPlaces();
  const mapRef = useRef<YandexMapInstance | null>(null);
  const clustererRef = useRef<YandexClustererInstance | null>(null);
  const placemarkRefs = useRef(new Map<number, YandexPlacemarkInstance>());

  // A place with only one of the two coordinates can't exist (there's a DB
  // check constraint), but the values still arrive as JSON numbers that a
  // misconfigured backend could ship as strings - hence Number.isFinite rather
  // than a null check, which "55.7" would pass.
  const placeableLocations = useMemo<PlaceableBurialPlace[]>(
    () =>
      burialPlaces
        .map((place) => ({
          ...place,
          latitude: Number(place.latitude),
          longitude: Number(place.longitude),
        }))
        .filter(
          (place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
        ),
    [burialPlaces],
  );

  const placeById = useMemo(
    () => new Map(placeableLocations.map((place) => [place.id, place])),
    [placeableLocations],
  );

  useEffect(() => {
    if (!focus) return;
    const map = mapRef.current;
    const place = placeById.get(focus.placeId);
    if (!map || !place) return;

    const openBalloon = () =>
      openPlacemarkBalloon(clustererRef.current, placemarkRefs.current.get(place.id) ?? null);
    // Balloon after the move: a placemark outside the viewport is not shown by
    // the clusterer, and the zoom change is what breaks it out of its cluster.
    const moving = map.setCenter([place.latitude, place.longitude], FOCUSED_MAP_ZOOM, {
      duration: 300,
    });
    if (moving?.then) {
      moving.then(openBalloon, () => {});
    } else {
      openBalloon();
    }
  }, [focus, placeById]);

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

  return (
    <>
      {placeableLocations.length === 0 && (
        <p className="absolute z-10 left-3 right-3 top-3 rounded-lg bg-surface/95 border border-border px-3 py-2 text-sm text-text-muted">
          Нет ни одного места захоронения с координатами. Укажите точку на карте при добавлении
          места — тогда человек появится здесь.
        </p>
      )}
      {/* @pbe/react-yandex-maps loads Yandex's modules on demand: only what a
          mounted component needs, nothing else. Anything extra has to be named
          in `modules` - without geoObject.addon.balloon a placemark has no
          .balloon at all and its balloonContent* properties are ignored, and
          without control.ZoomControl the map has no zoom buttons. */}
      <YMaps query={yandexMapsQuery}>
        <YandexMapComponent
          defaultState={{
            center: DEFAULT_MAP_CENTER,
            zoom: DEFAULT_MAP_ZOOM,
            controls: ['zoomControl'],
          }}
          modules={['control.ZoomControl']}
          width="100%"
          height="100%"
          instanceRef={(instance: unknown) => {
            mapRef.current = (instance as YandexMapInstance) ?? null;
          }}
        >
          <Clusterer
            options={{ preset: 'islands#invertedVioletClusterIcons' }}
            modules={['clusterer.addon.balloon']}
            instanceRef={(instance: unknown) => {
              clustererRef.current = (instance as YandexClustererInstance) ?? null;
            }}
          >
            {placeableLocations.map((place) => (
              <Placemark
                key={place.id}
                geometry={[place.latitude, place.longitude]}
                modules={['geoObject.addon.balloon', 'geoObject.addon.hint']}
                properties={{
                  hintContent: `${place.name}${place.city ? ` (${place.city})` : ''}`,
                  balloonContentHeader: escapeHtmlForBalloon(place.name),
                  balloonContentBody: buildBalloonContent(place),
                }}
                options={{ preset: 'islands#violetIcon' }}
                instanceRef={(instance: unknown) => {
                  if (instance) {
                    placemarkRefs.current.set(place.id, instance as YandexPlacemarkInstance);
                  } else {
                    placemarkRefs.current.delete(place.id);
                  }
                }}
              />
            ))}
          </Clusterer>
        </YandexMapComponent>
      </YMaps>
    </>
  );
}
