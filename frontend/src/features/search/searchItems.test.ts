import { describe, expect, it } from 'vitest';
import type { BurialPlace, PersonSearchResult, PersonSummary } from '@/shared/types';
import {
  buildSearchItems,
  formatPersonLifespan,
  formatPersonName,
  splitHighlight,
} from './searchItems';

function makePerson(overrides: Partial<PersonSearchResult> = {}): PersonSearchResult {
  return {
    id: 1,
    first_name: 'Пётр',
    last_name: 'Соколов',
    patronymic: 'Ильич',
    maiden_name: '',
    gender: 'M',
    status: 'alive',
    birth_date: null,
    birth_date_text: '',
    birth_place: '',
    death_date: null,
    death_date_text: '',
    photo: null,
    burial_place_detail: null,
    ...overrides,
  };
}

function makePlace(overrides: Partial<BurialPlace> = {}): BurialPlace {
  return {
    id: 10,
    name: 'Ваганьковское кладбище',
    city: 'Москва',
    latitude: 55.7761,
    longitude: 37.5589,
    address: '',
    description: '',
    persons: [],
    ...overrides,
  };
}

describe('formatPersonName', () => {
  it('joins the parts it has and never renders an empty label', () => {
    expect(formatPersonName(makePerson({ patronymic: '' }))).toBe('Соколов Пётр');
    expect(
      formatPersonName(makePerson({ first_name: '', last_name: '', patronymic: '' })),
    ).toBe('Без имени');
  });
});

describe('formatPersonLifespan', () => {
  it('shows a year range for someone deceased', () => {
    expect(
      formatPersonLifespan(
        makePerson({ status: 'deceased', birth_date: '1921-03-04', death_date: '1990-12-01' }),
      ),
    ).toBe('1921 – 1990');
  });

  it('falls back to free-form dates and marks unknown ones', () => {
    expect(
      formatPersonLifespan(
        makePerson({ status: 'deceased', birth_date_text: 'около 1920' }) as PersonSummary,
      ),
    ).toBe('около 1920 – ?');
  });

  it('shows only the birth year for someone alive', () => {
    expect(formatPersonLifespan(makePerson({ birth_date: '1950-06-01' }))).toBe('р. 1950');
    expect(formatPersonLifespan(makePerson())).toBe('');
  });
});

describe('buildSearchItems', () => {
  it('flattens people and places into one keyboard-navigable list', () => {
    const items = buildSearchItems({
      persons: [makePerson()],
      burial_places: [makePlace()],
    });

    expect(items.map((item) => item.group)).toEqual(['persons', 'places']);
    expect(items[0].title).toBe('Соколов Пётр Ильич');
    expect(items[0].selection).toEqual({ kind: 'person', person: makePerson() });
    expect(items[1].selection.kind).toBe('burial_place');
  });

  it('puts the burial place of a person into their subtitle', () => {
    const [item] = buildSearchItems({
      persons: [
        makePerson({
          status: 'deceased',
          birth_date: '1921-03-04',
          death_date: '1990-12-01',
          burial_place_detail: {
            id: 10,
            name: 'Ваганьковское',
            city: 'Москва',
            latitude: 55.7761,
            longitude: 37.5589,
          },
        }),
      ],
      burial_places: [],
    });

    expect(item.subtitle).toBe('1921 – 1990 · Ваганьковское');
  });

  it('counts the people buried at a place', () => {
    const person = makePerson() as PersonSummary;
    const items = buildSearchItems({
      persons: [],
      burial_places: [makePlace({ persons: [person] }), makePlace({ id: 11, persons: [] })],
    });

    expect(items[0].subtitle).toBe('Москва · 1 чел.');
    expect(items[1].subtitle).toBe('Москва · нет записей');
  });

  it('returns nothing before the first response arrives', () => {
    expect(buildSearchItems(undefined)).toEqual([]);
  });
});

describe('splitHighlight', () => {
  it('marks every word of the query, case-insensitively', () => {
    const parts = splitHighlight('Соколов Пётр Ильич', 'соколов ильич');
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual([
      'Соколов',
      'Ильич',
    ]);
  });

  it('treats е and ё as the same letter, like the backend does', () => {
    const parts = splitHighlight('Пётр', 'петр');
    expect(parts).toEqual([{ text: 'Пётр', match: true }]);
  });

  it('returns the text untouched when nothing matches', () => {
    expect(splitHighlight('Соколов', 'морозов')).toEqual([{ text: 'Соколов', match: false }]);
  });

  it('handles an empty query and empty text', () => {
    expect(splitHighlight('Соколов', '   ')).toEqual([{ text: 'Соколов', match: false }]);
    expect(splitHighlight('', 'соколов')).toEqual([]);
  });
});
