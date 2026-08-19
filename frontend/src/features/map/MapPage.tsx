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
    // A person search result doesn't carry burial place coordinates
    // directly (Person.burial_place is just an id) - recentering on a
    // person from the map isn't wired up further than this for now; the
    // burial-place search path above covers the map's primary use case.
  }

  return (
    <div className="map-page">
      <div className="page-toolbar">
        <SearchBar onSelect={handleSearchSelect} />
      </div>
      <div className="map-view-container">
        <MapView onMapInstanceReady={(instance) => (mapInstanceRef.current = instance)} />
      </div>
    </div>
  );
}
