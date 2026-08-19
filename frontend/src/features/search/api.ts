import { apiClient } from '@/shared/api/client';
import type { SearchResults } from '@/shared/types';

export async function search(query: string): Promise<SearchResults> {
  const { data } = await apiClient.get<SearchResults>('/search/', { params: { q: query } });
  return data;
}
