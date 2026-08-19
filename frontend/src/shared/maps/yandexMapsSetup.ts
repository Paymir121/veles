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

// Default view: all of Russia, since the project is Russian and we don't
// know where the family's burial places are until data loads.
export const DEFAULT_MAP_CENTER: [number, number] = [61.698653, 99.505405];
export const DEFAULT_MAP_ZOOM = 3;
export const FOCUSED_MAP_ZOOM = 14;

// Minimal shape of the ymaps.Map instance methods callers actually use, so
// they don't need to import the full @types/yandex-maps typings package
// throughout the codebase.
export interface YandexMapInstance {
  setCenter: (coordinates: [number, number], zoom?: number) => void;
}
