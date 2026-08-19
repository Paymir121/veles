import { describe, expect, it } from 'vitest';
import type { TreeNode, TreeNodeData } from '@/shared/types';
import { CELL_H, CELL_W, layoutTree } from './elkLayoutAdapter';

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
});
