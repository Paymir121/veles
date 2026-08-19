import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBurialPlace,
  createPerson,
  deletePerson,
  fetchAllBurialPlaces,
  fetchBurialPlace,
  fetchPerson,
  fetchPersons,
  searchBurialPlaces,
  updatePerson,
  type PersonListParams,
  type PersonSubmitFiles,
} from './api';
import type { BurialPlaceCreatePayload, PersonFormValues } from './types';

export function usePersons(params?: PersonListParams) {
  return useQuery({
    queryKey: ['persons', params],
    queryFn: () => fetchPersons(params),
  });
}

export function usePerson(id: number | undefined) {
  return useQuery({
    queryKey: ['persons', id],
    queryFn: () => fetchPerson(id as number),
    enabled: id !== undefined,
  });
}

// Query key 'tree' is a cross-feature convention shared with
// features/tree/hooks.ts (GET /api/tree/) - invalidating it here keeps the
// tree view in sync after a person is created/edited/deleted, without
// features/persons importing anything from features/tree.
function useInvalidatePersonQueries() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['persons'] });
    queryClient.invalidateQueries({ queryKey: ['tree'] });
    queryClient.invalidateQueries({ queryKey: ['burial-places'] });
  };
}

export function useCreatePerson() {
  const invalidate = useInvalidatePersonQueries();
  return useMutation({
    mutationFn: ({ values, files }: { values: PersonFormValues; files: PersonSubmitFiles }) =>
      createPerson(values, files),
    onSuccess: invalidate,
  });
}

export function useUpdatePerson() {
  const invalidate = useInvalidatePersonQueries();
  return useMutation({
    mutationFn: ({
      id,
      values,
      files,
    }: {
      id: number;
      values: PersonFormValues;
      files: PersonSubmitFiles;
    }) => updatePerson(id, values, files),
    onSuccess: invalidate,
  });
}

export function useDeletePerson() {
  const invalidate = useInvalidatePersonQueries();
  return useMutation({
    mutationFn: (id: number) => deletePerson(id),
    onSuccess: invalidate,
  });
}

export function useAllBurialPlaces() {
  return useQuery({
    queryKey: ['burial-places'],
    queryFn: fetchAllBurialPlaces,
  });
}

export function useBurialPlaceSearch(query: string) {
  return useQuery({
    queryKey: ['burial-places', 'search', query],
    queryFn: () => searchBurialPlaces(query),
    enabled: query.trim().length > 0,
  });
}

export function useBurialPlace(id: number | '' | null | undefined) {
  return useQuery({
    queryKey: ['burial-places', id],
    queryFn: () => fetchBurialPlace(id as number),
    enabled: typeof id === 'number',
  });
}

export function useCreateBurialPlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BurialPlaceCreatePayload) => createBurialPlace(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['burial-places'] });
    },
  });
}
