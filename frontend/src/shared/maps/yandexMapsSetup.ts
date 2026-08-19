// Small wrapper isolating Yandex Maps SDK-specific setup (API key + query
// config) so callers don't need to know the SDK's config shape directly -
// similar in spirit to familyChartAdapter.ts for family-chart, just much
// thinner since @pbe/react-yandex-maps' <YMaps>/<Map>/<Placemark>/<Clusterer>
// components already do most of the SDK wrapping for us.
//
// Lives under shared/ (not features/map/) because features/persons also
// needs it now (the burial-place map picker) - features aren't supposed to
// import each other directly, only from shared, the same rule already
// followed for features/search.
//
// Verified against @pbe/react-yandex-maps v1.2.5's shipped type
// declarations (typings/Provider.d.ts, typings/Map.d.ts,
// typings/geo-objects/Placemark.d.ts, typings/clusterization/Clusterer.d.ts,
// typings/hooks/useYMaps.d.ts, fetched from unpkg.com on 2026-08-18):
// YMaps's `query` prop accepts {apikey, lang, ...}; Map exposes
// `instanceRef` for getting the underlying ymaps.Map instance (used to call
// setCenter for search-driven recentering); `useYMaps(modules?)` returns the
// loaded `ymaps` SDK object (or null until ready) to any component nested
// under <YMaps> - this is how the burial-place picker reaches
// `ymaps.geocode()` without a second API key or a backend call (same
// classical JS API v2.1 that also draws the map, confirmed via Yandex's own
// docs - the "JavaScript API and HTTP Geocoder" key type covers both).

export const YANDEX_MAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY as string | undefined;

export function hasYandexMapsApiKey(): boolean {
  return Boolean(YANDEX_MAPS_API_KEY && YANDEX_MAPS_API_KEY.trim().length > 0);
}

export const yandexMapsQuery = {
  apikey: YANDEX_MAPS_API_KEY,
  lang: 'ru_RU' as const,
};

// Default view: Votkinsk, Udmurt Republic.
export const DEFAULT_MAP_CENTER: [number, number] = [57.0518, 53.9872];
export const DEFAULT_MAP_ZOOM = 12;
export const FOCUSED_MAP_ZOOM = 14;

// Minimal shape of the ymaps.Map instance methods callers actually use, so
// they don't need to import the full @types/yandex-maps typings package
// throughout the codebase.
//
// setCenter returns a vow.Promise (Yandex's own promise implementation) that
// resolves once the map has finished moving -- verified in the official JS API
// 2.1 reference for Map.setCenter. Typed as a thenable rather than a real
// Promise since vow is not one, and callers only ever `.then()` on it.
export interface YandexMapInstance {
  setCenter: (
    coordinates: [number, number],
    zoom?: number,
    options?: { duration?: number },
  ) => { then: (onDone: () => void, onFail?: () => void) => unknown } | undefined;
  getCenter?: () => [number, number];
  getZoom?: () => number;
}

export interface YandexPlacemarkInstance {
  balloon: { open: () => void };
}

export interface YandexClustererInstance {
  getObjectState: (geoObject: unknown) => {
    isShown: boolean;
    isClustered: boolean;
    cluster?: { state: { set: (key: string, value: unknown) => void } };
  };
  balloon: { open: (cluster: unknown) => void };
}

/**
 * Opens a placemark's balloon, going through its cluster when the placemark is
 * currently collapsed into one.
 *
 * This exact sequence (getObjectState -> set 'activeObject' -> open the
 * clusterer's balloon, else open the placemark's own) is the pattern from the
 * official JS API 2.1 reference for Clusterer.getObjectState -- a clustered
 * placemark has no balloon of its own to open, so calling
 * `placemark.balloon.open()` on it silently does nothing.
 */
export function openPlacemarkBalloon(
  clusterer: YandexClustererInstance | null,
  placemark: YandexPlacemarkInstance | null,
): void {
  if (!placemark) return;
  const state = clusterer?.getObjectState(placemark);
  if (state?.isClustered && state.cluster) {
    state.cluster.state.set('activeObject', placemark);
    clusterer?.balloon.open(state.cluster);
    return;
  }
  placemark.balloon.open();
}
