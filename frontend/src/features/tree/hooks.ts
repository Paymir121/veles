import { useQuery } from '@tanstack/react-query';
import { fetchTree } from './api';

// Query key 'tree' is shared (as a string convention, not an import) with
// features/persons/hooks.ts, which invalidates it after person
// create/update/delete so the tree view refetches automatically.
export function useTree() {
  return useQuery({
    queryKey: ['tree'],
    queryFn: fetchTree,
    // Global QueryClient defaults to a single retry; Vite can be up before
    // Django finishes booting even with main.py's port wait, and a failed
    // first /api/tree/ used to stick as a permanent error. Retry with
    // backoff so a startup race self-heals instead of needing a reload.
    retry: 8,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 4000),
  });
}
