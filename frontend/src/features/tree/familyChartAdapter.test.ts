import { describe, expect, it } from 'vitest';
import type { TreeNode, TreeNodeData } from '@/shared/types';
import {
  buildCardInnerHtml,
  escapeHtml,
  extractPersonId,
  findFamilyIslands,
  findWidestRootId,
  formatFullName,
  formatLifespan,
} from './familyChartAdapter';

// These tests cover the pure, DOM-free parts of the adapter: the shape
// transform from a family-chart TreeDatum's nested {data:{data:...}} down
// to display strings, plus id extraction (used by the card click handler).
// Actually invoking createFamilyChart() would require a real DOM + d3's SVG
// layout code, which jsdom doesn't fully implement (no getBBox) - so that
// integration is exercised manually/via Playwright instead, not here.

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

describe('escapeHtml', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert("x")&'y'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&amp;&#039;y&#039;&lt;/script&gt;',
    );
  });
});

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

describe('extractPersonId', () => {
  it('reads the id from the nested Datum (TreeDatum.data.id)', () => {
    const treeDatum = { data: { id: '42', data: makeTreeNodeData() } };
    expect(extractPersonId(treeDatum)).toBe('42');
  });
});

describe('buildCardInnerHtml', () => {
  it('renders name and lifespan, HTML-escaped', () => {
    const treeDatum = {
      data: {
        id: '1',
        data: makeTreeNodeData({ last_name: '<b>Петров</b>' }),
      },
    };
    const html = buildCardInnerHtml(treeDatum);
    expect(html).toContain('&lt;b&gt;Петров&lt;/b&gt; Иван Сергеевич');
    expect(html).not.toContain('<b>Петров</b>');
  });

  it('renders a placeholder avatar div when avatar is null', () => {
    const treeDatum = { data: { id: '1', data: makeTreeNodeData({ avatar: null }) } };
    const html = buildCardInnerHtml(treeDatum);
    expect(html).toContain('f3-card-avatar-placeholder');
    expect(html).not.toContain('<img');
  });

  it('renders an <img> when avatar is set', () => {
    const treeDatum = {
      data: { id: '1', data: makeTreeNodeData({ avatar: '/media/avatars/1.jpg' }) },
    };
    const html = buildCardInnerHtml(treeDatum);
    expect(html).toContain('<img class="f3-card-avatar" src="/media/avatars/1.jpg"');
  });

  it('marks living people with the alive status class', () => {
    const treeDatum = { data: { id: '1', data: makeTreeNodeData({ status: 'alive' }) } };
    expect(buildCardInnerHtml(treeDatum)).toContain('f3-card-status-alive');
    expect(buildCardInnerHtml(treeDatum)).not.toContain('f3-card-status-deceased');
  });

  it('marks deceased people with the deceased status class', () => {
    const treeDatum = { data: { id: '1', data: makeTreeNodeData({ status: 'deceased' }) } };
    expect(buildCardInnerHtml(treeDatum)).toContain('f3-card-status-deceased');
    expect(buildCardInnerHtml(treeDatum)).not.toContain('f3-card-status-alive');
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

describe('findFamilyIslands / findWidestRootId', () => {
  it('lists parentless people, widest bloodline first, and ignores married-in roots for the default', () => {
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
    expect(findWidestRootId(tree)).toBe('root');
  });

  it('includes a disconnected parentless family as its own island', () => {
    const tree = [
      makeNode('a', { last_name: 'Соколов', first_name: 'Пётр', patronymic: '' }, { children: ['b'] }),
      makeNode('b', { last_name: 'Соколов', first_name: 'Сергей', patronymic: '' }, { parents: ['a'] }),
      makeNode('c', { last_name: 'Белов', first_name: 'Игорь', patronymic: '' }, {}),
    ];

    const islands = findFamilyIslands(tree);
    expect(islands.map((island) => island.id)).toEqual(['a', 'c']);
    expect(findWidestRootId(tree)).toBe('a');
  });
});
