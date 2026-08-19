import { useQuery } from '@tanstack/react-query';
import { fetchBurialPlaces, type BurialPlaceListParams } from './api';

export function useBurialPlaces(params?: BurialPlaceListParams) {
  return useQuery({
    queryKey: ['burial-places', params],
    queryFn: () => fetchBurialPlaces(params),
  });
}
