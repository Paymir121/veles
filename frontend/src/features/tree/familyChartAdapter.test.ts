import { describe, expect, it } from 'vitest';
import type { TreeNode, TreeNodeData } from '@/shared/types';
import {
  findFamilyIslands,
  formatFullName,
  formatLifespan,
} from './familyChartAdapter';

function makeTreeNodeData(overrides: Partial<TreeNodeData> = {}): TreeNodeData {
  return {
    first_name: 'Иван',
    last_name: 'Петров',
    patronymic: 'Сергеевич',
    gender: 'M',
    gender_actual: 'M',
    birth_date: '1950-01-01',
    death_date: '',
    status: 'alive',
    avatar: null,
    ...overrides,
  };
}

describe('formatFullName', () => {
  it('joins last/first/patronymic with spaces, skipping empty parts', () => {
    expect(formatFullName(makeTreeNodeData({ patronymic: '' }))).toBe('Петров Иван');
    expect(formatFullName(makeTreeNodeData())).toBe('Петров Иван Сергеевич');
  });

  it('falls back to a placeholder when nothing is set', () => {
    expect(
      formatFullName(makeTreeNodeData({ first_name: '', last_name: '', patronymic: '' })),
    ).toBe('Без имени');
  });
});

describe('formatLifespan', () => {
  it('shows just the birth date for a living person', () => {
    expect(formatLifespan(makeTreeNodeData({ status: 'alive', birth_date: '1950-01-01' }))).toBe(
      '1950-01-01',
    );
  });

  it('shows a birth-death range for a deceased person', () => {
    expect(
      formatLifespan(
        makeTreeNodeData({
          status: 'deceased',
          birth_date: '1950-01-01',
          death_date: '2020-05-05',
        }),
      ),
    ).toBe('1950-01-01 – 2020-05-05');
  });

  it('uses "?" placeholders for missing dates', () => {
    expect(
      formatLifespan(makeTreeNodeData({ status: 'deceased', birth_date: '', death_date: '' })),
    ).toBe('? – ?');
  });
});

function makeNode(
  id: string,
  data: Partial<TreeNodeData>,
  rels: Partial<TreeNode['rels']>,
): TreeNode {
  return {
    id,
    data: makeTreeNodeData(data),
    rels: { parents: [], spouses: [], children: [], ...rels },
  };
}

describe('findFamilyIslands', () => {
  it('lists parentless people, widest bloodline first', () => {
    const tree = [
      makeNode(
        'inlaw',
        { last_name: 'Морозов', first_name: 'Виктор', patronymic: '' },
        { spouses: ['child'], children: ['grand'] },
      ),
      makeNode(
        'root',
        { last_name: 'Соколов', first_name: 'Пётр', patronymic: '' },
        { children: ['child'] },
      ),
      makeNode(
        'child',
        { last_name: 'Соколова', first_name: 'Ольга', patronymic: '' },
        { parents: ['root'], spouses: ['inlaw'], children: ['grand'] },
      ),
      makeNode(
        'grand',
        { last_name: 'Морозова', first_name: 'Анастасия', patronymic: '' },
        { parents: ['inlaw', 'child'] },
      ),
    ];

    const islands = findFamilyIslands(tree);
    expect(islands.map((island) => island.id)).toEqual(['root', 'inlaw']);
    expect(islands[0].descendantCount).toBeGreaterThan(islands[1].descendantCount);
    expect(islands[0].id).toBe('root');
  });

  it('includes a disconnected parentless family as its own island', () => {
    const tree = [
      makeNode('a', { last_name: 'Соколов', first_name: 'Пётр', patronymic: '' }, { children: ['b'] }),
      makeNode('b', { last_name: 'Соколов', first_name: 'Сергей', patronymic: '' }, { parents: ['a'] }),
      makeNode('c', { last_name: 'Белов', first_name: 'Игорь', patronymic: '' }, {}),
    ];

    const islands = findFamilyIslands(tree);
    expect(islands.map((island) => island.id)).toEqual(['a', 'c']);
    expect(islands[0].id).toBe('a');
  });
});
