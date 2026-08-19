import type { BurialPlace, PersonSearchResult, PersonSummary, SearchResults } from '@/shared/types';
import { formatFullName } from '@/shared/utils/formatName';
import type { SearchSelection } from './types';

export type SearchItemGroup = 'persons' | 'places';

export interface SearchItem {
  key: string;
  group: SearchItemGroup;
  title: string;
  subtitle: string;
  selection: SearchSelection;
}

export const GROUP_LABELS: Record<SearchItemGroup, string> = {
  persons: 'Люди',
  places: 'Места захоронения',
};

/** @deprecated Use formatFullName from shared/utils/formatName instead. */
export const formatPersonName = formatFullName;

function yearOf(isoDate: string | null, freeText: string): string {
  if (isoDate) return isoDate.slice(0, 4);
  return freeText.trim();
}

/** "1921 – 1990" for someone deceased, "р. 1950" for someone alive. Free-form
 *  dates ("около 1920") are shown as typed, since they have no parseable year. */
export function formatPersonLifespan(person: PersonSummary): string {
  const birth = yearOf(person.birth_date, person.birth_date_text);
  if (person.status === 'deceased') {
    const death = yearOf(person.death_date, person.death_date_text);
    if (!birth && !death) return 'умер(ла)';
    return `${birth || '?'} – ${death || '?'}`;
  }
  return birth ? `р. ${birth}` : '';
}

function personSubtitle(person: PersonSearchResult): string {
  return [
    formatPersonLifespan(person),
    person.birth_place,
    person.burial_place_detail?.name,
  ]
    .filter(Boolean)
    .join(' · ');
}

function placeSubtitle(place: BurialPlace): string {
  const count = place.persons?.length ?? 0;
  return [place.city, count > 0 ? `${count} чел.` : 'нет записей'].filter(Boolean).join(' · ');
}

/** Both result groups as one flat list, in display order: keyboard navigation
 *  moves through people and places as a single sequence. */
export function buildSearchItems(results: SearchResults | undefined): SearchItem[] {
  if (!results) return [];
  const persons: SearchItem[] = results.persons.map((person) => ({
    key: `person-${person.id}`,
    group: 'persons',
    title: formatFullName(person),
    subtitle: personSubtitle(person),
    selection: { kind: 'person', person },
  }));
  const places: SearchItem[] = results.burial_places.map((place) => ({
    key: `place-${place.id}`,
    group: 'places',
    title: place.name || 'Без названия',
    subtitle: placeSubtitle(place),
    selection: { kind: 'burial_place', burialPlace: place },
  }));
  return [...persons, ...places];
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

// Lowercase + ё→е, the same normalisation the backend search applies. Both
// substitutions are one character for one character, so an index in the
// normalised string is the same index in the original - that's what makes
// highlighting the ORIGINAL text possible below.
function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е');
}

/** Splits `text` into matched/unmatched runs against every word of `query`,
 *  so the dropdown can show why a result matched. */
export function splitHighlight(text: string, query: string): HighlightPart[] {
  const tokens = query
    .split(/\s+/)
    .map(normalizeForMatch)
    .filter((token) => token.length > 0);
  const haystack = normalizeForMatch(text);
  // Some locales' toLowerCase() changes string length (e.g. "İ"), which would
  // make the index mapping above wrong - fall back to no highlighting.
  if (tokens.length === 0 || haystack.length !== text.length) {
    return text ? [{ text, match: false }] : [];
  }

  const matched = new Array<boolean>(text.length).fill(false);
  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(token, from);
      if (at === -1) break;
      for (let i = at; i < at + token.length; i += 1) matched[i] = true;
      from = at + 1;
    }
  }

  const parts: HighlightPart[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const last = parts[parts.length - 1];
    if (last && last.match === matched[i]) {
      last.text += text[i];
    } else {
      parts.push({ text: text[i], match: matched[i] });
    }
  }
  return parts;
}
