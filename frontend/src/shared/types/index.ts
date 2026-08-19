// Shared types mirroring the backend API contract exactly (see the Django
// serializers in genealogy/serializers.py). This is the one place the exact
// field names/shapes live - features import from here instead of redefining
// their own copies, the same way you'd share a DTO/schema module across
// several Django apps.

export type Gender = 'M' | 'F' | 'U';
export type PersonStatus = 'alive' | 'deceased';
export type UnionStatus = 'married' | 'divorced' | 'widowed' | 'partnership' | '';

export interface ExtraInfoItem {
  category: string;
  title: string;
  role?: string;
  date_from?: string;
  date_to?: string;
  description?: string;
}

export interface Person {
  id: number;
  first_name: string;
  last_name: string;
  patronymic: string;
  maiden_name: string;
  gender: Gender;
  birth_date: string | null;
  birth_date_text: string;
  birth_place: string;
  status: PersonStatus;
  death_date: string | null;
  death_date_text: string;
  father: number | null;
  mother: number | null;
  burial_place: number | null;
  burial_plot_details: string;
  photo: string | null;
  grave_photo: string | null;
  extra_info: ExtraInfoItem[];
  notes: string;
  linked_user: number | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

// What PersonListSerializer returns: the subset of Person that gets nested
// inside other payloads (BurialPlace.persons, /api/search/ hits). Kept
// separate from Person so code reading a nested person can't reach for a
// field the backend never sent.
export type PersonSummary = Pick<
  Person,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'patronymic'
  | 'maiden_name'
  | 'gender'
  | 'status'
  | 'birth_date'
  | 'birth_date_text'
  | 'birth_place'
  | 'death_date'
  | 'death_date_text'
  | 'photo'
>;

// A place without its own nested persons (BurialPlaceBriefSerializer), which
// is how a place travels inside a person to avoid recursion.
export type BurialPlaceBrief = Pick<
  BurialPlace,
  'id' | 'name' | 'city' | 'latitude' | 'longitude'
>;

// A /api/search/ person hit: carries its burial place inline so the map can
// fly to a person's grave without a follow-up request. Note the distinct key
// name - `burial_place` is a plain id on every other endpoint.
export interface PersonSearchResult extends PersonSummary {
  burial_place_detail: BurialPlaceBrief | null;
}

export interface BurialPlace {
  id: number;
  name: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  address: string;
  description: string;
  // Nested + read-only, per the API contract (BurialPlaceViewSet prefetches
  // "persons" so this comes for free without an extra request).
  persons: PersonSummary[];
}

export interface Union {
  id: number;
  person1: number;
  person2: number;
  date_start: string | null;
  date_start_text: string;
  date_end: string | null;
  date_end_text: string;
  status: UnionStatus;
  notes: string;
}

// Shape returned by GET /api/tree/, matching the family-chart library's data
// format exactly (id/data/rels) - see features/tree/familyChartAdapter.ts.
export interface TreeNodeData {
  first_name: string;
  last_name: string;
  patronymic: string;
  // family-chart only understands M/F. gender_actual carries the real value
  // (including "U") since the backend cosmetically maps U -> M for this
  // endpoint only. See AI_MEMORY.md "Gender-fallback для family-chart".
  gender: 'M' | 'F';
  gender_actual: Gender;
  birth_date: string;
  death_date: string;
  status: PersonStatus;
  avatar: string | null;
}

export interface TreeNodeRels {
  parents: string[];
  spouses: string[];
  children: string[];
}

export interface TreeNode {
  id: string;
  data: TreeNodeData;
  rels: TreeNodeRels;
}

export interface SearchResults {
  persons: PersonSearchResult[];
  burial_places: BurialPlace[];
}

export interface User {
  id: number;
  username: string;
  email?: string;
}

// DRF's default list pagination shape. /api/tree/ and /api/search/ are
// explicitly documented as NOT using this (tree is a raw array, search is a
// plain {persons, burial_places} object) - only /api/persons/,
// /api/burial-places/ and /api/unions/ list endpoints may be paginated.
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
