import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from './yandexMapsSetup';

export interface StoredMapViewport {
  center: [number, number];
  zoom: number;
}

const STORAGE_KEY = 'veles-map-viewport';

export function getStoredMapViewport(): StoredMapViewport {
  if (typeof window === 'undefined') {
    return { center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM };
    const parsed = JSON.parse(raw) as Partial<StoredMapViewport>;
    if (
      Array.isArray(parsed.center)
      && parsed.center.length === 2
      && parsed.center.every((value) => Number.isFinite(value))
      && Number.isFinite(parsed.zoom)
    ) {
      return {
        center: [Number(parsed.center[0]), Number(parsed.center[1])],
        zoom: Number(parsed.zoom),
      };
    }
  } catch {
    // Ignore broken persisted data and fall back to defaults.
  }
  return { center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM };
}

export function storeMapViewport(viewport: StoredMapViewport): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(viewport));
  } catch {
    // Ignore storage failures - the map still works without persistence.
  }
}
