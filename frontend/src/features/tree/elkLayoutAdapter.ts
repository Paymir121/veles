import type { Node, Edge } from '@xyflow/react';
import type { TreeNode, TreeNodeData } from '@/shared/types';
import { formatFullName } from '@/shared/utils/formatName';
import { formatLifespan } from './familyChartAdapter';

export type TreeEdgeKind = 'leafStem' | 'branch' | 'root';

export interface PersonNodeData extends Record<string, unknown> {
  kind: 'person';
  label: string;
  lifespan: string;
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

/** Pixel size of one backend grid cell (positions). Node boxes can be smaller. */
export const CELL_W = 124;
export const CELL_H = 56;
export const PERSON_NODE_WIDTH = 216;
export const PERSON_NODE_HEIGHT = 72;
export const FAMILY_NODE_WIDTH = 18;
export const FAMILY_NODE_HEIGHT = 8;

interface FamilyUnit {
  id: string;
  parentIds: string[];
  childIds: string[];
}

function familyNodeId(parentIds: string[]): string {
  return `family:${[...parentIds].sort().join('+')}`;
}

function buildFamilyUnits(data: TreeNode[]): FamilyUnit[] {
  const ids = new Set(data.map((node) => node.id));
  const families = new Map<string, FamilyUnit>();

  for (const node of data) {
    const parentIds = node.rels.parents.filter((parentId) => ids.has(parentId));
    if (parentIds.length === 0) continue;
    const id = familyNodeId(parentIds);
    const existing = families.get(id);
    if (existing) {
      existing.childIds.push(node.id);
      continue;
    }
    families.set(id, { id, parentIds: [...parentIds].sort(), childIds: [node.id] });
  }

  return [...families.values()];
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

function cellX(person: TreeNode): number {
  return (person.x ?? 0) * CELL_W;
}

function cellY(person: TreeNode): number {
  return (person.y ?? 0) * CELL_H;
}

/** Turn backend grid cells into React Flow nodes/edges. No packing here. */
export function layoutTree(
  data: TreeNode[],
): { nodes: Node<TreeLayoutNodeData>[]; edges: Edge<TreeEdgeData>[] } {
  if (data.length === 0) return { nodes: [], edges: [] };

  const families = buildFamilyUnits(data);
  const nodes: Node<TreeLayoutNodeData>[] = data.map((person) => ({
    id: person.id,
    type: 'person',
    position: { x: cellX(person), y: cellY(person) },
    data: {
      kind: 'person',
      label: formatFullName(person.data),
      lifespan: formatLifespan(person.data),
      status: person.data.status,
      isRootGeneration: person.rels.parents.length === 0,
      hasChildren: person.rels.children.length > 0,
      avatar: person.data.avatar,
      showPhotos: true,
    },
    width: PERSON_NODE_WIDTH,
    height: PERSON_NODE_HEIGHT,
  }));

  for (const family of families) {
    const parents = family.parentIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is Node<TreeLayoutNodeData> => Boolean(node));
    const children = family.childIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is Node<TreeLayoutNodeData> => Boolean(node));
    if (parents.length === 0 || children.length === 0) continue;

    // The bar is the couple's union. A child who sits far away (married into
    // another subtree) must not drag it into the gap between families.
    const parentCenterX =
      parents.reduce((sum, node) => sum + node.position.x + PERSON_NODE_WIDTH / 2, 0) / parents.length;
    const parentTop = Math.min(...parents.map((node) => node.position.y));
    const childBottom = Math.max(...children.map((node) => node.position.y + PERSON_NODE_HEIGHT));

    nodes.push({
      id: family.id,
      type: 'family',
      position: {
        x: parentCenterX - FAMILY_NODE_WIDTH / 2,
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

  return { nodes, edges: buildEdges(data, families) };
}
