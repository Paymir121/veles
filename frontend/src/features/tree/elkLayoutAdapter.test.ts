import { describe, expect, it } from 'vitest';
import type { TreeNode, TreeNodeData } from '@/shared/types';
import { layoutTree } from './elkLayoutAdapter';

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
    rels: {
      parents: [],
      spouses: [],
      children: [],
      ...rels,
    },
  };
}

describe('layoutTree', () => {
  it('creates separate family connectors for half-siblings with different fathers', async () => {
    const tree = [
      makeNode('father-a', { first_name: 'Андрей' }, { children: ['child-a'] }),
      makeNode('father-b', { first_name: 'Борис' }, { children: ['child-b'] }),
      makeNode('mother', { first_name: 'Мария', gender: 'F', gender_actual: 'F' }, {
        children: ['child-a', 'child-b'],
      }),
      makeNode('child-a', { first_name: 'Анна', gender: 'F', gender_actual: 'F' }, {
        parents: ['father-a', 'mother'],
      }),
      makeNode('child-b', { first_name: 'Вера', gender: 'F', gender_actual: 'F' }, {
        parents: ['father-b', 'mother'],
      }),
    ];

    const { nodes, edges } = await layoutTree(tree);
    const familyNodes = nodes.filter((node) => node.data.kind === 'family');

    expect(familyNodes).toHaveLength(2);
    expect(familyNodes.map((node) => node.id).sort()).toEqual([
      'family:father-a+mother',
      'family:father-b+mother',
    ]);
    expect(edges.some((edge) => edge.source === 'mother' && edge.target === 'family:father-a+mother')).toBe(true);
    expect(edges.some((edge) => edge.source === 'mother' && edge.target === 'family:father-b+mother')).toBe(true);
  });

  it('aligns unrelated root people on the same baseline', async () => {
    const tree = [
      makeNode('root-a', { first_name: 'Алексей' }, { children: ['child-a'] }),
      makeNode('child-a', { first_name: 'Павел' }, { parents: ['root-a'] }),
      makeNode('root-b', { first_name: 'Борис' }),
    ];

    const { nodes } = await layoutTree(tree);
    const rootA = nodes.find((node) => node.id === 'root-a');
    const rootB = nodes.find((node) => node.id === 'root-b');

    expect(rootA?.position.y).toBe(rootB?.position.y);
  });
});
