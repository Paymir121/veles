import type { ExtraInfoItem, Gender, PersonStatus } from '@/shared/types';

// Editable subset of Person - excludes server-managed fields (id, photo URLs,
// created_by/updated_by, timestamps, linked_user). "" stands in for "no
// value selected" on number fields since native <select>/<input> values are
// always strings.
export interface PersonFormValues {
  first_name: string;
  last_name: string;
  patronymic: string;
  maiden_name: string;
  gender: Gender;
  birth_date: string;
  birth_date_text: string;
  birth_place: string;
  status: PersonStatus;
  death_date: string;
  death_date_text: string;
  father: number | '';
  mother: number | '';
  burial_place: number | '';
  burial_plot_details: string;
  notes: string;
  extra_info: ExtraInfoItem[];
}

export const EMPTY_PERSON_FORM_VALUES: PersonFormValues = {
  first_name: '',
  last_name: '',
  patronymic: '',
  maiden_name: '',
  gender: 'U',
  birth_date: '',
  birth_date_text: '',
  birth_place: '',
  status: 'alive',
  death_date: '',
  death_date_text: '',
  father: '',
  mother: '',
  burial_place: '',
  burial_plot_details: '',
  notes: '',
  extra_info: [],
};

export interface BurialPlaceCreatePayload {
  name: string;
  city: string;
  address: string;
  latitude: number | '';
  longitude: number | '';
  description: string;
}

/** A burial place being typed into the person form but not saved yet. Kept as
 *  strings because it mirrors input values; it's turned into a real place when
 *  the person is saved (see PersonForm), not by a separate button - a point
 *  picked on the map used to be silently dropped on submit. */
export interface BurialPlaceDraft {
  name: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
}

export const EMPTY_BURIAL_PLACE_DRAFT: BurialPlaceDraft = {
  name: '',
  city: '',
  address: '',
  latitude: '',
  longitude: '',
};

export function isBurialPlaceDraftFilled(draft: BurialPlaceDraft): boolean {
  return Object.values(draft).some((value) => value.trim().length > 0);
}
