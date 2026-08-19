import type { BurialPlace, Person } from '@/shared/types';

// The event SearchBar emits outward via onSelect - tree and map each
// interpret it their own way (focus a node / recenter the map). search
// itself has no idea tree or map exist.
export type SearchSelection =
  { kind: 'person'; person: Person } | { kind: 'burial_place'; burialPlace: BurialPlace };
