import { apiClient } from '@/shared/api/client';
import { unwrapList } from '@/shared/api/unwrapList';
import type { BurialPlace, Person } from '@/shared/types';
import type { BurialPlaceCreatePayload, PersonFormValues } from './types';

export interface PersonListParams {
  search?: string;
  gender?: string;
  status?: string;
  ordering?: string;
}

export async function fetchPersons(params?: PersonListParams): Promise<Person[]> {
  const { data } = await apiClient.get('/persons/', { params });
  return unwrapList<Person>(data);
}

export async function fetchPerson(id: number): Promise<Person> {
  const { data } = await apiClient.get<Person>(`/persons/${id}/`);
  return data;
}

/**
 * Turns the alive/deceased toggle into the right JSON values: fields that
 * only apply to a deceased person are explicitly cleared (null/"") rather
 * than merely hidden, so switching an existing deceased person back to
 * alive actually wipes their burial info server-side instead of leaving it
 * stale (PATCH treats an OMITTED field as "leave unchanged", not "clear").
 */
function toJsonPayload(values: PersonFormValues): Record<string, unknown> {
  const isDeceased = values.status === 'deceased';
  return {
    first_name: values.first_name,
    last_name: values.last_name,
    patronymic: values.patronymic,
    maiden_name: values.maiden_name,
    gender: values.gender,
    birth_date: values.birth_date || null,
    birth_date_text: values.birth_date_text,
    birth_place: values.birth_place,
    status: values.status,
    death_date: isDeceased ? values.death_date || null : null,
    death_date_text: isDeceased ? values.death_date_text : '',
    father: values.father === '' ? null : values.father,
    mother: values.mother === '' ? null : values.mother,
    burial_place: isDeceased && values.burial_place !== '' ? values.burial_place : null,
    burial_plot_details: isDeceased ? values.burial_plot_details : '',
    notes: values.notes,
    extra_info: values.extra_info,
  };
}

/**
 * Multipart form-data version of the same payload, used only when an actual
 * photo file is being uploaded (DRF needs multipart for file fields; plain
 * JSON is used otherwise - see PersonFormPage.tsx). Null/empty optional
 * fields are omitted rather than sent as empty strings, since multipart
 * can't represent JSON null and DRF's handling of "" for a nullable FK is
 * backend-config-dependent; extra_info (a JSONField) is sent as a JSON
 * string, which is how DRF's own browsable-api multipart form encodes
 * JSONField values.
 */
function toFormData(
  values: PersonFormValues,
  photo: File | null,
  gravePhoto: File | null,
): FormData {
  const isDeceased = values.status === 'deceased';
  const formData = new FormData();

  const append = (key: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return;
    formData.append(key, String(value));
  };

  append('first_name', values.first_name);
  append('last_name', values.last_name);
  append('patronymic', values.patronymic);
  append('maiden_name', values.maiden_name);
  append('gender', values.gender);
  append('birth_date', values.birth_date);
  append('birth_date_text', values.birth_date_text);
  append('birth_place', values.birth_place);
  formData.append('status', values.status);
  append('death_date', isDeceased ? values.death_date : '');
  append('death_date_text', isDeceased ? values.death_date_text : '');
  append('father', values.father);
  append('mother', values.mother);
  append('burial_place', isDeceased ? values.burial_place : '');
  append('burial_plot_details', isDeceased ? values.burial_plot_details : '');
  append('notes', values.notes);
  formData.append('extra_info', JSON.stringify(values.extra_info));

  if (photo) formData.append('photo', photo);
  if (gravePhoto) formData.append('grave_photo', gravePhoto);

  return formData;
}

export interface PersonSubmitFiles {
  photo: File | null;
  gravePhoto: File | null;
}

export async function createPerson(
  values: PersonFormValues,
  files: PersonSubmitFiles,
): Promise<Person> {
  const hasFile = Boolean(files.photo || files.gravePhoto);
  const { data } = hasFile
    ? await apiClient.post<Person>('/persons/', toFormData(values, files.photo, files.gravePhoto))
    : await apiClient.post<Person>('/persons/', toJsonPayload(values));
  return data;
}

export async function updatePerson(
  id: number,
  values: PersonFormValues,
  files: PersonSubmitFiles,
): Promise<Person> {
  const hasFile = Boolean(files.photo || files.gravePhoto);
  const { data } = hasFile
    ? await apiClient.patch<Person>(
        `/persons/${id}/`,
        toFormData(values, files.photo, files.gravePhoto),
      )
    : await apiClient.patch<Person>(`/persons/${id}/`, toJsonPayload(values));
  return data;
}

export async function deletePerson(id: number): Promise<void> {
  await apiClient.delete(`/persons/${id}/`);
}

// Burial places are also needed here (the inline "create new burial place"
// mini-form on PersonForm, plus resolving a person's burial place for
// display). features/map/api.ts hits the same /api/burial-places/ resource
// independently for its own needs (the map view) - a small amount of
// duplication is the price of features not importing each other directly.
export async function searchBurialPlaces(query: string): Promise<BurialPlace[]> {
  const { data } = await apiClient.get('/burial-places/', { params: { search: query } });
  return unwrapList<BurialPlace>(data);
}

export async function fetchBurialPlace(id: number): Promise<BurialPlace> {
  const { data } = await apiClient.get<BurialPlace>(`/burial-places/${id}/`);
  return data;
}

export async function createBurialPlace(payload: BurialPlaceCreatePayload): Promise<BurialPlace> {
  const { data } = await apiClient.post<BurialPlace>('/burial-places/', {
    name: payload.name,
    city: payload.city,
    address: payload.address,
    description: payload.description,
    latitude: payload.latitude === '' ? null : payload.latitude,
    longitude: payload.longitude === '' ? null : payload.longitude,
  });
  return data;
}
