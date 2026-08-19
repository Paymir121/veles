import { describe, expect, it } from 'vitest';
import type { TreeNode, TreeNodeData } from '@/shared/types';
import { assignAlignedGenerations, CELL_W, layoutTree } from './elkLayoutAdapter';

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

  it('puts a spouse without parents on the same generation as their partner', () => {
    const tree = [
      makeNode('root', { first_name: 'Валерий', last_name: 'Логинов' }, { children: ['sergey'] }),
      makeNode('sergey', { first_name: 'Сергей', last_name: 'Логинов' }, {
        parents: ['root'],
        spouses: ['svetlana'],
        children: ['denis'],
      }),
      makeNode('svetlana', { first_name: 'Светлана', last_name: 'Логинова', gender: 'F', gender_actual: 'F' }, {
        spouses: ['sergey'],
        children: ['denis'],
      }),
      makeNode('denis', { first_name: 'Денис', last_name: 'Логинов' }, {
        parents: ['sergey', 'svetlana'],
      }),
    ];

    const generations = assignAlignedGenerations(tree);
    expect(generations.get('sergey')).toBe(generations.get('svetlana'));
    expect(generations.get('denis')).toBe((generations.get('sergey') ?? 0) + 1);
  });

  it('keeps co-parents on one row and children one grid row above', async () => {
    const tree = [
      makeNode('father', { first_name: 'Вадим', last_name: 'Романов' }, { children: ['nikita', 'anton'] }),
      makeNode('mother', { first_name: 'Светлана', last_name: 'Романова', gender: 'F', gender_actual: 'F' }, {
        children: ['nikita', 'anton'],
      }),
      makeNode('nikita', { first_name: 'Никита', last_name: 'Романов' }, { parents: ['father', 'mother'] }),
      makeNode('anton', { first_name: 'Антон', last_name: 'Романов' }, { parents: ['father', 'mother'] }),
    ];

    const { nodes } = await layoutTree(tree);
    const father = nodes.find((node) => node.id === 'father');
    const mother = nodes.find((node) => node.id === 'mother');
    const nikita = nodes.find((node) => node.id === 'nikita');
    const anton = nodes.find((node) => node.id === 'anton');

    expect(father?.position.y).toBe(mother?.position.y);
    expect(nikita?.position.y).toBe(anton?.position.y);
    expect(nikita?.position.y).toBeLessThan(father?.position.y ?? 0);

    const siblingGap = Math.abs((nikita?.position.x ?? 0) - (anton?.position.x ?? 0)) - CELL_W;
    expect(siblingGap).toBe(CELL_W);
  });

  it('keeps siblings on one row even if only one of them has children', async () => {
    const tree = [
      makeNode('father', { first_name: 'Вадим' }, { children: ['nikita', 'anton'] }),
      makeNode('mother', { first_name: 'Светлана', gender: 'F', gender_actual: 'F' }, { children: ['nikita', 'anton'] }),
      makeNode('nikita', { first_name: 'Никита' }, { parents: ['father', 'mother'] }),
      makeNode('anton', { first_name: 'Антон' }, { parents: ['father', 'mother'], children: ['darya'] }),
      makeNode('darya', { first_name: 'Дарья', gender: 'F', gender_actual: 'F' }, { parents: ['anton'] }),
    ];

    const { nodes } = await layoutTree(tree);
    const nikita = nodes.find((node) => node.id === 'nikita');
    const anton = nodes.find((node) => node.id === 'anton');
    expect(nikita?.position.y).toBe(anton?.position.y);
    const gap = Math.abs((nikita?.position.x ?? 0) - (anton?.position.x ?? 0));
    expect(gap).toBeLessThanOrEqual(CELL_W * 4);
  });
});
