import { apiClient } from '@/shared/api/client';
import { unwrapList } from '@/shared/api/unwrapList';
import type { BurialPlace } from '@/shared/types';

export interface BurialPlaceListParams {
  search?: string;
  city?: string;
}

// BurialPlaceViewSet nests `persons` on both list and detail per the API
// contract, so this single call gives MapView everything it needs for
// placemark balloons without an extra request per place.
export async function fetchBurialPlaces(params?: BurialPlaceListParams): Promise<BurialPlace[]> {
  const { data } = await apiClient.get('/burial-places/', { params });
  return unwrapList<BurialPlace>(data);
}
