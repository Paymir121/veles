import type { Node, Edge } from '@xyflow/react';
import type { Gender, TreeNode, TreeNodeData } from '@/shared/types';
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
  gender: Gender;
  showPhotos: boolean;
  selected: boolean;
  showEdit: boolean;
  onEdit?: (personId: string) => void;
}

export interface FamilyNodeData extends Record<string, unknown> {
  kind: 'family';
  parentIds: string[];
  childIds: string[];
  parentHandlePct: Record<string, number>;
  childHandlePct: Record<string, number>;
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
export const FAMILY_NODE_MIN_WIDTH = 24;
export const FAMILY_NODE_WIDTH = FAMILY_NODE_MIN_WIDTH;
export const FAMILY_NODE_HEIGHT = 4;
const NEARBY_CHILD_SLACK = CELL_W * 2;

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

export const TREE_EDGE_TYPE = 'organic';

/** Relative thickness: trunk > wood > living shoot. Colour lives in CSS. */
function edgeStyleForKind(kind: TreeEdgeKind): NonNullable<Edge<TreeEdgeData>['style']> {
  if (kind === 'leafStem') return { strokeWidth: 1.7 };
  if (kind === 'root') return { strokeWidth: 4.4 };
  return { strokeWidth: 2.9 };
}

function personCenterX(node: Node<TreeLayoutNodeData>): number {
  return node.position.x + PERSON_NODE_WIDTH / 2;
}

function handlePct(centerX: number, barLeft: number, barWidth: number): number {
  if (barWidth <= 0) return 50;
  const pct = ((centerX - barLeft) / barWidth) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
}

function buildEdges(
  data: TreeNode[],
  families: FamilyUnit[],
): Edge<TreeEdgeData>[] {
  const byId = new Map(data.map((person) => [person.id, person]));
  const edges: Edge<TreeEdgeData>[] = [];
  const edgeSet = new Set<string>();

  for (const family of families) {
    for (const parentId of family.parentIds) {
      const parent = byId.get(parentId);
      if (!parent) continue;
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
        sourceHandle: 'out',
        targetHandle: `in-${parentId}`,
        type: TREE_EDGE_TYPE,
        selectable: false,
        focusable: false,
        data: { kind },
        style: edgeStyleForKind(kind),
      });
    }

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
        sourceHandle: `out-${childId}`,
        targetHandle: 'in',
        type: TREE_EDGE_TYPE,
        selectable: false,
        focusable: false,
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
      gender: person.data.gender_actual,
      showPhotos: true,
      selected: false,
      showEdit: false,
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

    // The bar sits under the couple. Nearby children can widen it; a child who
    // married into another subtree must not drag it across the gap.
    const parentCenters = parents.map(personCenterX);
    const parentMin = Math.min(...parentCenters);
    const parentMax = Math.max(...parentCenters);
    const nearbyChildCenters = children
      .map(personCenterX)
      .filter((centerX) => centerX >= parentMin - NEARBY_CHILD_SLACK && centerX <= parentMax + NEARBY_CHILD_SLACK);
    const barMin = Math.min(parentMin, ...nearbyChildCenters);
    const barMax = Math.max(parentMax, ...nearbyChildCenters);
    const barWidth = Math.max(FAMILY_NODE_MIN_WIDTH, barMax - barMin);
    const barLeft = (barMin + barMax) / 2 - barWidth / 2;
    const parentTop = Math.min(...parents.map((node) => node.position.y));
    const childBottom = Math.max(...children.map((node) => node.position.y + PERSON_NODE_HEIGHT));

    const parentHandlePct: Record<string, number> = {};
    for (const parent of parents) {
      parentHandlePct[parent.id] = handlePct(personCenterX(parent), barLeft, barWidth);
    }
    const childHandlePct: Record<string, number> = {};
    for (const child of children) {
      childHandlePct[child.id] = handlePct(personCenterX(child), barLeft, barWidth);
    }

    nodes.push({
      id: family.id,
      type: 'family',
      position: {
        x: barLeft,
        y: (childBottom + parentTop) / 2 - FAMILY_NODE_HEIGHT / 2,
      },
      data: {
        kind: 'family',
        parentIds: family.parentIds,
        childIds: family.childIds,
        parentHandlePct,
        childHandlePct,
      },
      width: barWidth,
      height: FAMILY_NODE_HEIGHT,
      selectable: false,
      focusable: false,
    });
  }

  return { nodes, edges: buildEdges(data, families) };
}
