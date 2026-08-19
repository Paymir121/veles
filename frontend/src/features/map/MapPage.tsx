import { useRef, useState } from 'react';
import { SearchBar } from '@/features/search/SearchBar';
import { formatPersonName } from '@/features/search/searchItems';
import type { SearchSelection } from '@/features/search/types';
import type { BurialPlaceBrief } from '@/shared/types';
import { MapView } from './MapView';
import type { MapFocusRequest } from './types';

function hasCoordinates(place: BurialPlaceBrief): boolean {
  return Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude));
}

export function MapPage() {
  const [focus, setFocus] = useState<MapFocusRequest | null>(null);
  const [notice, setNotice] = useState('');
  const tokenRef = useRef(0);

  function focusPlace(placeId: number) {
    tokenRef.current += 1;
    setNotice('');
    setFocus({ placeId, token: tokenRef.current });
  }

  // A person is shown on the map through their grave: the search hit carries
  // the place inline (burial_place_detail), so this needs no extra request.
  // Every dead end says why out loud - silently doing nothing was the old
  // behaviour and looked like a broken search.
  function handleSearchSelect(selection: SearchSelection) {
    if (selection.kind === 'burial_place') {
      const place = selection.burialPlace;
      if (!hasCoordinates(place)) {
        setNotice(`У места «${place.name}» не указаны координаты — на карте его нет.`);
        return;
      }
      focusPlace(place.id);
      return;
    }

    const person = selection.person;
    const place = person.burial_place_detail;
    if (!place) {
      setNotice(`У ${formatPersonName(person)} не указано место захоронения.`);
      return;
    }
    if (!hasCoordinates(place)) {
      setNotice(
        `Место «${place.name}» указано без координат — откройте его в профиле человека, чтобы добавить точку.`,
      );
      return;
    }
    focusPlace(place.id);
  }

  return (
    <div className="map-page">
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-3 mb-4">
        <SearchBar onSelect={handleSearchSelect} placeholder="Поиск: человек, кладбище, город..." />
      </div>

      {notice && (
        <div className="flex items-start gap-3 mb-3 rounded-lg bg-bg-muted px-3 py-2 text-sm">
          <span className="flex-1">{notice}</span>
          <button type="button" className="btn-ghost text-xs" onClick={() => setNotice('')}>
            Скрыть
          </button>
        </div>
      )}

      <div className="map-view-container relative">
        <MapView focus={focus} />
      </div>
    </div>
  );
}
