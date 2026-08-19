import { describe, expect, it } from 'vitest';
import type { TreeNode, TreeNodeData } from '@/shared/types';
import { countPeople, filterTreePeople, groupTreePeople } from './treePeople';

function makeNode(
  id: string,
  data: Partial<TreeNodeData>,
  rels: Partial<TreeNode['rels']> = {},
): TreeNode {
  return {
    id,
    data: {
      first_name: 'Иван',
      last_name: 'Петров',
      patronymic: '',
      gender: 'M',
      gender_actual: 'M',
      birth_date: '',
      death_date: '',
      status: 'alive',
      avatar: null,
      ...data,
    },
    rels: { parents: [], spouses: [], children: [], ...rels },
    x: 0,
    y: 0,
  };
}

describe('groupTreePeople', () => {
  it('keeps one connected family as a single group, spouses included', () => {
    const tree = [
      makeNode('inlaw', { last_name: 'Морозов', first_name: 'Виктор' }, {
        spouses: ['child'],
        children: ['grand'],
      }),
      makeNode('root', { last_name: 'Соколов', first_name: 'Пётр' }, { children: ['child'] }),
      makeNode('child', { last_name: 'Соколова', first_name: 'Ольга' }, {
        parents: ['root'],
        spouses: ['inlaw'],
        children: ['grand'],
      }),
      makeNode('grand', { last_name: 'Морозова', first_name: 'Анастасия' }, {
        parents: ['inlaw', 'child'],
      }),
    ];

    const groups = groupTreePeople(tree);
    expect(groups).toHaveLength(1);
    // Named after the widest bloodline's root, and listing everyone reachable -
    // including the married-in spouse family-chart can't draw from that root.
    expect(groups[0].label).toBe('Соколов Пётр');
    expect(groups[0].people.map((person) => person.id).sort()).toEqual([
      'child',
      'grand',
      'inlaw',
      'root',
    ]);
  });

  it('separates unrelated families, largest first, and sorts people by name', () => {
    const tree = [
      makeNode('b', { last_name: 'Белов', first_name: 'Игорь' }),
      makeNode('s1', { last_name: 'Соколов', first_name: 'Пётр' }, { children: ['s2'] }),
      makeNode('s2', { last_name: 'Соколов', first_name: 'Андрей' }, { parents: ['s1'] }),
    ];

    const groups = groupTreePeople(tree);
    expect(groups.map((group) => group.label)).toEqual(['Соколов Пётр', 'Белов Игорь']);
    expect(groups[0].people.map((person) => person.name)).toEqual([
      'Соколов Андрей',
      'Соколов Пётр',
    ]);
    expect(countPeople(groups)).toBe(3);
  });

  it('carries a lifespan for the list', () => {
    const groups = groupTreePeople([
      makeNode('a', { status: 'deceased', birth_date: '1921', death_date: '1990' }),
    ]);
    expect(groups[0].people[0].lifespan).toBe('1921 – 1990');
  });
});

describe('filterTreePeople', () => {
  const groups = groupTreePeople([
    makeNode('a', { last_name: 'Соколов', first_name: 'Пётр', birth_date: '1921' }),
    makeNode('b', { last_name: 'Соколова', first_name: 'Анна', birth_date: '1925' }),
    makeNode('c', { last_name: 'Морозов', first_name: 'Виктор' }),
  ]);

  it('requires every word to match, so extra words narrow the list', () => {
    expect(
      filterTreePeople(groups, 'соколов 1921').flatMap((group) =>
        group.people.map((person) => person.id),
      ),
    ).toEqual(['a']);
  });

  it('ignores case and the ё/е difference', () => {
    expect(
      filterTreePeople(groups, 'петр').flatMap((group) => group.people.map((person) => person.id)),
    ).toEqual(['a']);
  });

  it('drops groups that no longer have anyone and returns everything for a blank query', () => {
    expect(filterTreePeople(groups, 'морозов')).toHaveLength(1);
    expect(countPeople(filterTreePeople(groups, '  '))).toBe(3);
    expect(filterTreePeople(groups, 'нетакого')).toEqual([]);
  });
});
