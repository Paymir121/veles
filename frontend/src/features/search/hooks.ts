import { useQuery } from '@tanstack/react-query';
import { search } from './api';

export function useSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['search', trimmed],
    queryFn: () => search(trimmed),
    enabled: trimmed.length > 0,
    staleTime: 30_000,
    // Keep the previous query's hits on screen while the next request is in
    // flight, so the dropdown doesn't blink empty on every keystroke.
    placeholderData: (previous) => previous,
  });
}
