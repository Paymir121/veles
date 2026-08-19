import type { PaginatedResponse } from '@/shared/types';

/**
 * DRF list endpoints may or may not be paginated depending on the ViewSet's
 * pagination_class. Rather than hard-coding an assumption we can't verify
 * against a live backend yet, this accepts either a plain array or DRF's
 * standard {count, next, previous, results} envelope and always returns a
 * plain array - the only shape the UI ever needs to render.
 *
 * NOTE: if /api/persons/ or /api/burial-places/ turn out to be paginated
 * with a small page size, list views (father/mother pickers, search) that
 * rely on `?search=` narrowing the result set are fine, but any UI that
 * assumes it has *every* record (there currently isn't one) would need
 * real pagination handling instead of this helper.
 */
export function unwrapList<T>(data: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  return data.results;
}
