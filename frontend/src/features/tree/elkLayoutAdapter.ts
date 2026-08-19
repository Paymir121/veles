import type { Node, Edge } from '@xyflow/react';
import type { TreeNode, TreeNodeData } from '@/shared/types';
import { formatShortName } from '@/shared/utils/formatName';

export type TreeEdgeKind = 'leafStem' | 'branch' | 'root';

export interface PersonNodeData extends Record<string, unknown> {
  kind: 'person';
  label: string;
  status: TreeNodeData['status'];
  isRootGeneration: boolean;
  hasChildren: boolean;
  avatar: string | null;
  showPhotos: boolean;
}

export interface FamilyNodeData extends Record<string, unknown> {
  kind: 'family';
  parentIds: string[];
  childIds: string[];
}

export type TreeLayoutNodeData = PersonNodeData | FamilyNodeData;

export interface TreeEdgeData extends Record<string, unknown> {
  kind: TreeEdgeKind;
}

/** One grid cell = one person node. Gap between people = one empty cell. */
export const CELL_W = 132;
export const CELL_H = 70;
export const CELL_GAP = 1;
export const COL_STEP = 1 + CELL_GAP;
export const FAMILY_NODE_WIDTH = 18;
export const FAMILY_NODE_HEIGHT = 8;
/** Person row, empty row for the family bar, next person row. */
export const ROW_STRIDE = 2;

interface FamilyUnit {
  id: string;
  parentIds: string[];
  childIds: string[];
}

function familyNodeId(parentIds: string[], childId: string): string {
  const parentsKey = parentIds.length > 0 ? [...parentIds].sort().join('+') : `unknown-${childId}`;
  return `family:${parentsKey}`;
}

function buildFamilyUnits(data: TreeNode[]): FamilyUnit[] {
  const ids = new Set(data.map((node) => node.id));
  const families = new Map<string, FamilyUnit>();

  for (const node of data) {
    const parentIds = node.rels.parents.filter((parentId) => ids.has(parentId));
    if (parentIds.length === 0) continue;
    const id = familyNodeId(parentIds, node.id);
    const existing = families.get(id);
    if (existing) {
      existing.childIds.push(node.id);
      continue;
    }
    families.set(id, { id, parentIds: [...parentIds].sort(), childIds: [node.id] });
  }

  return [...families.values()];
}

function bloodGeneration(data: TreeNode[]): Map<string, number> {
  const byId = new Map(data.map((node) => [node.id, node]));
  const memo = new Map<string, number>();

  function generationOf(id: string, visiting: Set<string>): number {
    if (memo.has(id)) return memo.get(id) as number;
    if (visiting.has(id)) return 0;
    const person = byId.get(id);
    if (!person || person.rels.parents.length === 0) {
      memo.set(id, 0);
      return 0;
    }
    visiting.add(id);
    const generation = Math.max(
      ...person.rels.parents
        .filter((parentId) => byId.has(parentId))
        .map((parentId) => generationOf(parentId, visiting) + 1),
      0,
    );
    visiting.delete(id);
    memo.set(id, generation);
    return generation;
  }

  for (const node of data) generationOf(node.id, new Set());
  return memo;
}

/** Blood generation. Parentless in-laws join their partner's row; nobody else is pulled. */
export function assignAlignedGenerations(data: TreeNode[]): Map<string, number> {
  const byId = new Map(data.map((person) => [person.id, person]));
  const gen = bloodGeneration(data);
  const families = buildFamilyUnits(data);
  const hasParents = (id: string) => (byId.get(id)?.rels.parents.length ?? 0) > 0;

  for (let step = 0; step < 16; step += 1) {
    let changed = false;
    const raise = (id: string, next: number) => {
      const current = gen.get(id) ?? 0;
      if (next > current) {
        gen.set(id, next);
        changed = true;
      }
    };

    for (const family of families) {
      const rooted = family.parentIds.filter(hasParents);
      if (rooted.length === 0) continue;
      const target = Math.max(...rooted.map((id) => gen.get(id) ?? 0));
      for (const id of family.parentIds) {
        if (!hasParents(id)) raise(id, target);
      }
      const parentGen = Math.max(...family.parentIds.map((id) => gen.get(id) ?? 0));
      for (const id of family.childIds) raise(id, parentGen + 1);
    }

    for (const person of data) {
      if (hasParents(person.id)) continue;
      for (const spouseId of person.rels.spouses) {
        if (!byId.has(spouseId)) continue;
        raise(person.id, gen.get(spouseId) ?? 0);
      }
    }

    if (!changed) break;
  }

  for (const family of families) {
    if (family.parentIds.length < 2) continue;
    const together = Math.max(...family.parentIds.map((id) => gen.get(id) ?? 0));
    for (const id of family.parentIds) gen.set(id, together);
  }

  return gen;
}

function personSortKey(person: TreeNode): string {
  return `${person.data.birth_date || '9999'}|${person.data.last_name}|${person.data.first_name}|${person.id}`;
}

function sortPeople(ids: string[], byId: Map<string, TreeNode>): string[] {
  return [...ids].sort((left, right) => {
    const a = byId.get(left);
    const b = byId.get(right);
    if (!a || !b) return left.localeCompare(right);
    return personSortKey(a).localeCompare(personSortKey(b), 'ru');
  });
}

function sortCouple(ids: string[], byId: Map<string, TreeNode>): string[] {
  return [...ids].sort((left, right) => {
    const a = byId.get(left);
    const b = byId.get(right);
    const genderA = a?.data.gender_actual || a?.data.gender;
    const genderB = b?.data.gender_actual || b?.data.gender;
    if (genderA === 'M' && genderB !== 'M') return -1;
    if (genderB === 'M' && genderA !== 'M') return 1;
    return sortPeople([left, right], byId)[0] === left ? -1 : 1;
  });
}

function hasFatherAndMother(parentIds: string[], byId: Map<string, TreeNode>): boolean {
  const genders = parentIds.map((id) => {
    const person = byId.get(id);
    return person?.data.gender_actual || person?.data.gender;
  });
  return genders.includes('M') && genders.includes('F');
}

/** Natural child order, mirrored when parents are father-left / mother-right. */
function sortChildren(family: FamilyUnit, byId: Map<string, TreeNode>): string[] {
  const kids = sortPeople(family.childIds, byId);
  if (family.parentIds.length >= 2 && hasFatherAndMother(family.parentIds, byId)) {
    return kids.reverse();
  }
  return kids;
}

function farEnough(col: number, occupied: number[]): boolean {
  return occupied.every((used) => Math.abs(used - col) >= COL_STEP);
}

function connectedComponents(data: TreeNode[]): TreeNode[][] {
  const byId = new Map(data.map((person) => [person.id, person]));
  const seen = new Set<string>();
  const components: TreeNode[][] = [];

  for (const person of data) {
    if (seen.has(person.id)) continue;
    const queue = [person.id];
    seen.add(person.id);
    const ids: string[] = [];
    while (queue.length > 0) {
      const id = queue.pop() as string;
      ids.push(id);
      const node = byId.get(id);
      if (!node) continue;
      for (const next of [...node.rels.parents, ...node.rels.children, ...node.rels.spouses]) {
        if (!byId.has(next) || seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    components.push(ids.map((id) => byId.get(id) as TreeNode));
  }

  components.sort((left, right) => right.length - left.length);
  return components;
}

function packColumns(
  people: TreeNode[],
  families: FamilyUnit[],
  gen: Map<string, number>,
): Map<string, number> {
  const byId = new Map(people.map((person) => [person.id, person]));
  const ids = new Set(people.map((person) => person.id));
  const col = new Map<string, number>();
  const familiesByParent = new Map<string, FamilyUnit[]>();
  for (const family of families) {
    for (const parentId of family.parentIds) {
      const list = familiesByParent.get(parentId) ?? [];
      list.push(family);
      familiesByParent.set(parentId, list);
    }
  }

  const occupiedAt = (generation: number): number[] =>
    people
      .filter((person) => (gen.get(person.id) ?? 0) === generation && col.has(person.id))
      .map((person) => col.get(person.id) as number);

  const nearestFree = (generation: number, preferred: number): number => {
    const occupied = occupiedAt(generation);
    if (farEnough(preferred, occupied)) return preferred;
    for (let delta = 1; delta < 800; delta += 1) {
      if (farEnough(preferred + delta, occupied)) return preferred + delta;
      if (farEnough(preferred - delta, occupied)) return preferred - delta;
    }
    return preferred;
  };

  const place = (id: string, preferred: number) => {
    if (col.has(id)) return;
    col.set(id, nearestFree(gen.get(id) ?? 0, preferred));
  };

  const placeParents = (family: FamilyUnit, childCols: number[]) => {
    if (childCols.length === 0) return;
    const mid = (Math.min(...childCols) + Math.max(...childCols)) / 2;
    const unplaced = sortCouple(
      family.parentIds.filter((id) => ids.has(id) && !col.has(id)),
      byId,
    );
    const placed = family.parentIds.filter((id) => col.has(id));
    if (unplaced.length >= 2) {
      const left = nearestFree(gen.get(unplaced[0]) ?? 0, Math.round(mid - COL_STEP / 2));
      place(unplaced[0], left);
      place(unplaced[1], left + COL_STEP);
      return;
    }
    if (unplaced.length === 1) {
      let preferred = Math.round(mid);
      if (placed.length === 1) {
        preferred = (col.get(placed[0]) as number) + COL_STEP;
      }
      place(unplaced[0], preferred);
    }
  };

  function packFamily(family: FamilyUnit, origin: number): { left: number; right: number } {
    const kids = sortChildren(family, byId).filter((id) => ids.has(id));
    let cursor = origin;
    const childCols: number[] = [];
    let left = origin;
    let right = origin;
    for (const childId of kids) {
      const packed = packPerson(childId, cursor);
      childCols.push(packed.col);
      left = Math.min(left, packed.left);
      right = Math.max(right, packed.right);
      cursor = packed.right + COL_STEP;
    }
    placeParents(family, childCols);
    for (const parentId of family.parentIds) {
      if (!col.has(parentId)) continue;
      left = Math.min(left, col.get(parentId) as number);
      right = Math.max(right, col.get(parentId) as number);
    }
    return { left, right };
  }

  function packPerson(personId: string, origin: number): { col: number; left: number; right: number } {
    if (col.has(personId)) {
      const current = col.get(personId) as number;
      return { col: current, left: current, right: current };
    }
    const ownFamilies = (familiesByParent.get(personId) ?? []).filter((family) =>
      family.parentIds.every((id) => ids.has(id)) && family.childIds.every((id) => ids.has(id)),
    );
    if (ownFamilies.length === 0) {
      place(personId, origin);
      const current = col.get(personId) as number;
      return { col: current, left: current, right: current };
    }

    let cursor = origin;
    let left = origin;
    let right = origin;
    for (const family of ownFamilies) {
      const packed = packFamily(family, cursor);
      left = Math.min(left, packed.left);
      right = Math.max(right, packed.right);
      cursor = packed.right + COL_STEP;
    }
    if (!col.has(personId)) place(personId, Math.round((left + right) / 2));
    const current = col.get(personId) as number;
    return { col: current, left: Math.min(left, current), right: Math.max(right, current) };
  }

  const roots = people
    .filter((person) => person.rels.parents.length === 0)
    .sort((left, right) => {
      const byKids = right.rels.children.length - left.rels.children.length;
      if (byKids !== 0) return byKids;
      return personSortKey(left).localeCompare(personSortKey(right), 'ru');
    });

  let origin = 0;
  for (const person of roots) {
    if (col.has(person.id)) continue;
    const packed = packPerson(person.id, origin);
    origin = packed.right + COL_STEP * 2;
  }

  for (const person of people) {
    if (col.has(person.id)) continue;
    const packed = packPerson(person.id, origin);
    origin = packed.right + COL_STEP * 2;
  }

  const values = [...col.values()];
  const minCol = values.length > 0 ? Math.min(...values) : 0;
  if (minCol !== 0) {
    for (const [id, value] of col) col.set(id, value - minCol);
  }
  return col;
}

function getPersonVisualKind(person: TreeNode): 'leaf' | 'branch' | 'root' {
  const isRootGeneration = person.rels.parents.length === 0;
  if (person.data.status === 'alive') return 'leaf';
  return isRootGeneration ? 'root' : 'branch';
}

function getEdgeKindToPerson(person: TreeNode): TreeEdgeKind {
  const visualKind = getPersonVisualKind(person);
  if (visualKind === 'leaf') return 'leafStem';
  if (visualKind === 'root') return 'root';
  return 'branch';
}

function edgeStyleForKind(kind: TreeEdgeKind): NonNullable<Edge<TreeEdgeData>['style']> {
  if (kind === 'leafStem') return { stroke: '#2aa56d', strokeWidth: 2.1 };
  if (kind === 'root') return { stroke: '#6b4423', strokeWidth: 2.6 };
  return { stroke: '#8a5a2d', strokeWidth: 2.2 };
}

function pickHandleId(
  index: number,
  total: number,
  side: 'personSource' | 'familyTarget' | 'childTarget',
): string {
  const handles = side === 'personSource'
    ? ['top-left', 'top-center', 'top-right']
    : ['bottom-left', 'bottom-center', 'bottom-right'];
  if (total <= 1) return handles[1];
  const slot = Math.round((index / Math.max(total - 1, 1)) * (handles.length - 1));
  return handles[slot];
}

function buildEdges(
  data: TreeNode[],
  families: FamilyUnit[],
): Edge<TreeEdgeData>[] {
  const byId = new Map(data.map((person) => [person.id, person]));
  const familiesByParent = new Map<string, FamilyUnit[]>();
  for (const family of families) {
    for (const parentId of family.parentIds) {
      const list = familiesByParent.get(parentId) ?? [];
      list.push(family);
      familiesByParent.set(parentId, list);
    }
  }
  for (const list of familiesByParent.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }

  const edges: Edge<TreeEdgeData>[] = [];
  const edgeSet = new Set<string>();

  for (const family of families) {
    for (const parentId of family.parentIds) {
      const parent = byId.get(parentId);
      if (!parent) continue;
      const parentFamilies = familiesByParent.get(parentId) ?? [family];
      const familyIndexForParent = parentFamilies.findIndex((item) => item.id === family.id);
      const edgeId = `e-${parentId}-${family.id}`;
      if (edgeSet.has(edgeId)) continue;
      edgeSet.add(edgeId);
      const kind = getPersonVisualKind(parent) === 'root'
        ? 'root'
        : parent.data.status === 'alive'
          ? 'leafStem'
          : 'branch';
      edges.push({
        id: edgeId,
        source: parentId,
        target: family.id,
        sourceHandle: pickHandleId(
          familyIndexForParent >= 0 ? familyIndexForParent : 0,
          parentFamilies.length,
          'personSource',
        ),
        targetHandle: pickHandleId(
          family.parentIds.findIndex((id) => id === parentId),
          family.parentIds.length,
          'familyTarget',
        ),
        type: 'straight',
        data: { kind },
        style: edgeStyleForKind(kind),
      });
    }

    const sortedChildIds = [...family.childIds].sort();
    for (const childId of family.childIds) {
      const child = byId.get(childId);
      if (!child) continue;
      const edgeId = `e-${family.id}-${childId}`;
      if (edgeSet.has(edgeId)) continue;
      edgeSet.add(edgeId);
      const kind = getEdgeKindToPerson(child);
      edges.push({
        id: edgeId,
        source: family.id,
        target: childId,
        sourceHandle: 'top-center',
        targetHandle: pickHandleId(sortedChildIds.indexOf(childId), sortedChildIds.length, 'childTarget'),
        type: 'straight',
        data: { kind },
        style: edgeStyleForKind(kind),
      });
    }
  }

  return edges;
}

export async function layoutTree(
  data: TreeNode[],
): Promise<{ nodes: Node<TreeLayoutNodeData>[]; edges: Edge<TreeEdgeData>[] }> {
  if (data.length === 0) return { nodes: [], edges: [] };

  const gen = assignAlignedGenerations(data);
  const maxGen = Math.max(0, ...[...gen.values()]);
  const allFamilies = buildFamilyUnits(data);
  const components = connectedComponents(data);
  const col = new Map<string, number>();
  let origin = 0;

  for (const component of components) {
    const ids = new Set(component.map((person) => person.id));
    const families = allFamilies.filter((family) =>
      family.parentIds.every((id) => ids.has(id)) && family.childIds.every((id) => ids.has(id)),
    );
    const packed = packColumns(component, families, gen);
    const maxCol = Math.max(0, ...packed.values());
    for (const [id, value] of packed) col.set(id, origin + value);
    origin += maxCol + COL_STEP * 2;
  }

  const nodes: Node<TreeLayoutNodeData>[] = data.map((person) => ({
    id: person.id,
    type: 'person',
    position: {
      x: (col.get(person.id) ?? 0) * CELL_W,
      y: (maxGen - (gen.get(person.id) ?? 0)) * ROW_STRIDE * CELL_H,
    },
    data: {
      kind: 'person',
      label: formatShortName(person.data),
      status: person.data.status,
      isRootGeneration: person.rels.parents.length === 0,
      hasChildren: person.rels.children.length > 0,
      avatar: person.data.avatar,
      showPhotos: false,
    },
    width: CELL_W,
    height: CELL_H,
  }));

  for (const family of allFamilies) {
    const parents = family.parentIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is Node<TreeLayoutNodeData> => Boolean(node));
    const children = family.childIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is Node<TreeLayoutNodeData> => Boolean(node));
    if (parents.length === 0 || children.length === 0) continue;

    const parentCenterX = parents.reduce((sum, node) => sum + node.position.x + CELL_W / 2, 0) / parents.length;
    const childCenterX = children.reduce((sum, node) => sum + node.position.x + CELL_W / 2, 0) / children.length;
    const parentTop = Math.min(...parents.map((node) => node.position.y));
    const childBottom = Math.max(...children.map((node) => node.position.y + CELL_H));

    nodes.push({
      id: family.id,
      type: 'family',
      position: {
        x: (parentCenterX + childCenterX) / 2 - FAMILY_NODE_WIDTH / 2,
        y: (childBottom + parentTop) / 2 - FAMILY_NODE_HEIGHT / 2,
      },
      data: {
        kind: 'family',
        parentIds: family.parentIds,
        childIds: family.childIds,
      },
      width: FAMILY_NODE_WIDTH,
      height: FAMILY_NODE_HEIGHT,
    });
  }

  return { nodes, edges: buildEdges(data, allFamilies) };
}
