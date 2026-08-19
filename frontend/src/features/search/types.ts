import type { BurialPlace, PersonSearchResult } from '@/shared/types';

// The event SearchBar emits outward via onSelect - tree and map each
// interpret it their own way (centre a node / fly to a grave). search
// itself has no idea tree or map exist.
export type SearchSelection =
  | { kind: 'person'; person: PersonSearchResult }
  | { kind: 'burial_place'; burialPlace: BurialPlace };
