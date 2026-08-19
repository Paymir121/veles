import { useRef } from 'react';
import { SearchBar } from '@/features/search/SearchBar';
import type { SearchSelection } from '@/features/search/types';
import { FOCUSED_MAP_ZOOM, type YandexMapInstance } from '@/shared/maps/yandexMapsSetup';
import { MapView } from './MapView';

export function MapPage() {
  const mapInstanceRef = useRef<YandexMapInstance | null>(null);

  function handleSearchSelect(selection: SearchSelection) {
    if (selection.kind === 'burial_place') {
      const { latitude, longitude } = selection.burialPlace;
      if (latitude !== null && longitude !== null) {
        mapInstanceRef.current?.setCenter([latitude, longitude], FOCUSED_MAP_ZOOM);
      }
      return;
    }
  }

  return (
    <div className="map-page">
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-3 mb-4">
        <SearchBar onSelect={handleSearchSelect} />
      </div>
      <div className="map-view-container">
        <MapView onMapInstanceReady={(instance) => (mapInstanceRef.current = instance)} />
      </div>
    </div>
  );
}
