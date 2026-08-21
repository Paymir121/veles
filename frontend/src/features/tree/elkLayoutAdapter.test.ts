import { describe, expect, it } from 'vitest';
import type { TreeNode, TreeNodeData } from '@/shared/types';
import { CELL_H, CELL_W, FAMILY_NODE_WIDTH, PERSON_NODE_WIDTH, layoutTree } from './elkLayoutAdapter';

function makeNode(
  id: string,
  data: Partial<TreeNodeData>,
  rels: Partial<TreeNode['rels']> = {},
  cell: { x: number; y: number } = { x: 0, y: 0 },
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
    rels: {
      parents: [],
      spouses: [],
      children: [],
      ...rels,
    },
    x: cell.x,
    y: cell.y,
  };
}

describe('layoutTree', () => {
  it('scales backend grid cells to pixels', () => {
    const tree = [
      makeNode('a', { first_name: 'Анна' }, {}, { x: 2, y: 4 }),
    ];
    const { nodes } = layoutTree(tree);
    expect(nodes[0].position).toEqual({ x: 2 * CELL_W, y: 4 * CELL_H });
    expect(nodes[0].data).toMatchObject({
      kind: 'person',
      label: 'Петров Анна',
      lifespan: '',
    });
  });

  it('puts birth and death years on the person node', () => {
    const tree = [
      makeNode('a', { birth_date: '1950-03-01', death_date: '2020-01-01', status: 'deceased' }),
    ];
    const { nodes } = layoutTree(tree);
    expect(nodes[0].data).toMatchObject({ lifespan: '1950 – 2020' });
  });

  it('creates separate family connectors for half-siblings with different fathers', () => {
    const tree = [
      makeNode('father-a', { first_name: 'Андрей' }, { children: ['child-a'] }, { x: 0, y: 2 }),
      makeNode('father-b', { first_name: 'Борис' }, { children: ['child-b'] }, { x: 4, y: 2 }),
      makeNode('mother', { first_name: 'Мария', gender: 'F', gender_actual: 'F' }, {
        children: ['child-a', 'child-b'],
      }, { x: 2, y: 2 }),
      makeNode('child-a', { first_name: 'Анна', gender: 'F', gender_actual: 'F' }, {
        parents: ['father-a', 'mother'],
      }, { x: 0, y: 0 }),
      makeNode('child-b', { first_name: 'Вера', gender: 'F', gender_actual: 'F' }, {
        parents: ['father-b', 'mother'],
      }, { x: 4, y: 0 }),
    ];

    const { nodes, edges } = layoutTree(tree);
    const familyNodes = nodes.filter((node) => node.data.kind === 'family');

    expect(familyNodes).toHaveLength(2);
    expect(familyNodes.map((node) => node.id).sort()).toEqual([
      'family:father-a+mother',
      'family:father-b+mother',
    ]);
    expect(edges.some((edge) => edge.source === 'mother' && edge.target === 'family:father-a+mother')).toBe(true);
    expect(edges.some((edge) => edge.source === 'mother' && edge.target === 'family:father-b+mother')).toBe(true);
  });

  it('keeps the family bar under the couple when a child sits far away', () => {
    const tree = [
      makeNode('valery', { first_name: 'Валерий' }, { children: ['sergey', 'svetlana'] }, { x: 27, y: 10 }),
      makeNode(
        'galina',
        { first_name: 'Галина', gender: 'F', gender_actual: 'F' },
        { children: ['sergey', 'svetlana'] },
        { x: 29, y: 10 },
      ),
      makeNode(
        'svetlana',
        { first_name: 'Светлана', gender: 'F', gender_actual: 'F' },
        { parents: ['valery', 'galina'] },
        { x: 8, y: 4 },
      ),
      makeNode('sergey', { first_name: 'Сергей' }, { parents: ['valery', 'galina'] }, { x: 28, y: 8 }),
    ];
    const { nodes } = layoutTree(tree);
    const bar = nodes.find((node) => node.data.kind === 'family');
    expect(bar).toBeDefined();
    const coupleCenter = ((27 + 29) / 2) * CELL_W + PERSON_NODE_WIDTH / 2;
    const barCenter = bar!.position.x + FAMILY_NODE_WIDTH / 2;
    expect(Math.abs(barCenter - coupleCenter)).toBeLessThan(1);
    const childMid = ((8 + 28) / 2) * CELL_W + PERSON_NODE_WIDTH / 2;
    expect(Math.abs(barCenter - childMid)).toBeGreaterThan(CELL_W);
  });
});
