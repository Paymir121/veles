import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
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

const PERSON_NODE_WIDTH = 132;
const PERSON_NODE_HEIGHT = 70;
const FAMILY_NODE_WIDTH = 8;
const FAMILY_NODE_HEIGHT = 8;
const COMPONENT_GAP_X = 110;

const elk = new ELK();

interface FamilyUnit {
  id: string;
  parentIds: string[];
  childIds: string[];
}

interface LayoutRecord {
  id: string;
  kind: 'person' | 'family';
  width: number;
  height: number;
  person?: TreeNode;
  family?: FamilyUnit;
}

interface BuiltGraph {
  elkNode: ElkNode;
  rfEdges: Edge<TreeEdgeData>[];
  records: Map<string, LayoutRecord>;
}

function assignGenerations(data: TreeNode[]): Map<string, number> {
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

  for (const node of data) {
    generationOf(node.id, new Set());
  }
  return memo;
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
  if (kind === 'leafStem') {
    return { stroke: '#2aa56d', strokeWidth: 2.1 };
  }
  if (kind === 'root') {
    return { stroke: '#6b4423', strokeWidth: 2.6 };
  }
  return { stroke: '#8a5a2d', strokeWidth: 2.2 };
}

function familyNodeId(parentIds: string[], childId: string): string {
  const parentsKey = parentIds.length > 0 ? parentIds.join('+') : `unknown-${childId}`;
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
    families.set(id, { id, parentIds: [...parentIds], childIds: [node.id] });
  }

  return [...families.values()];
}

function buildElkGraph(data: TreeNode[]): BuiltGraph {
  const records = new Map<string, LayoutRecord>();
  const children: ElkNode[] = [];
  const edges: ElkExtendedEdge[] = [];
  const rfEdges: Edge<TreeEdgeData>[] = [];
  const edgeSet = new Set<string>();
  const families = buildFamilyUnits(data);
  const byId = new Map(data.map((person) => [person.id, person]));
  const generations = assignGenerations(data);

  for (const person of data) {
    records.set(person.id, {
      id: person.id,
      kind: 'person',
      width: PERSON_NODE_WIDTH,
      height: PERSON_NODE_HEIGHT,
      person,
    });
  }

  for (const family of families) {
    records.set(family.id, {
      id: family.id,
      kind: 'family',
      width: FAMILY_NODE_WIDTH,
      height: FAMILY_NODE_HEIGHT,
      family,
    });
  }

  const orderedRecords = [...records.values()].sort((a, b) => {
    if (a.kind === 'person' && b.kind === 'person') {
      const aPerson = a.person as TreeNode;
      const bPerson = b.person as TreeNode;
      const aGeneration = generations.get(a.id) ?? 0;
      const bGeneration = generations.get(b.id) ?? 0;
      if (aGeneration !== bGeneration) return aGeneration - bGeneration;

      const aParentsKey = aPerson.rels.parents.join('+');
      const bParentsKey = bPerson.rels.parents.join('+');
      if (aParentsKey !== bParentsKey) return aParentsKey.localeCompare(bParentsKey);

      return aPerson.data.last_name.localeCompare(bPerson.data.last_name, 'ru')
        || aPerson.data.first_name.localeCompare(bPerson.data.first_name, 'ru');
    }

    if (a.kind === 'family' && b.kind === 'family') {
      const aChildGeneration = Math.min(...(a.family?.childIds.map((id) => generations.get(id) ?? 0) ?? [0]));
      const bChildGeneration = Math.min(...(b.family?.childIds.map((id) => generations.get(id) ?? 0) ?? [0]));
      if (aChildGeneration !== bChildGeneration) return aChildGeneration - bChildGeneration;
      return (a.family?.parentIds.join('+') ?? '').localeCompare(b.family?.parentIds.join('+') ?? '');
    }

    return a.kind === 'person' ? -1 : 1;
  });

  for (const record of orderedRecords) {
    children.push({
      id: record.id,
      width: record.width,
      height: record.height,
    });
  }

  for (const family of families) {
    for (const parentId of family.parentIds) {
      if (!records.has(parentId)) continue;
      const edgeId = `e-${parentId}-${family.id}`;
      if (edgeSet.has(edgeId)) continue;
      edgeSet.add(edgeId);
      edges.push({ id: edgeId, sources: [parentId], targets: [family.id] });
      rfEdges.push({
        id: edgeId,
        source: parentId,
        target: family.id,
        type: 'smoothstep',
        data: {
          kind: (byId.get(parentId) && getPersonVisualKind(byId.get(parentId) as TreeNode) === 'root')
            ? 'root'
            : byId.get(parentId)?.data.status === 'alive'
              ? 'leafStem'
              : 'branch',
        },
        style: edgeStyleForKind(
          (byId.get(parentId) && getPersonVisualKind(byId.get(parentId) as TreeNode) === 'root')
            ? 'root'
            : byId.get(parentId)?.data.status === 'alive'
              ? 'leafStem'
              : 'branch',
        ),
      });
    }

    for (const childId of family.childIds) {
      if (!records.has(childId)) continue;
      const edgeId = `e-${family.id}-${childId}`;
      if (edgeSet.has(edgeId)) continue;
      edgeSet.add(edgeId);
      edges.push({ id: edgeId, sources: [family.id], targets: [childId] });
      rfEdges.push({
        id: edgeId,
        source: family.id,
        target: childId,
        data: { kind: getEdgeKindToPerson(byId.get(childId) as TreeNode) },
        type: 'smoothstep',
        style: edgeStyleForKind(getEdgeKindToPerson(byId.get(childId) as TreeNode)),
      });
    }
  }

  for (const node of data) {
    for (const spouseId of node.rels.spouses) {
      if (!records.has(spouseId) || node.id >= spouseId) continue;
      const edgeId = `layout-spouse-${node.id}-${spouseId}`;
      if (edgeSet.has(edgeId)) continue;
      edgeSet.add(edgeId);
      // Keep spouses near each other without drawing an extra visible edge.
      edges.push({
        id: edgeId,
        sources: [node.id],
        targets: [spouseId],
      });
    }
  }

  return {
    elkNode: {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'UP',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.spacing.nodeNode': '72',
        'elk.layered.spacing.nodeNodeBetweenLayers': '118',
        'elk.layered.spacing.edgeNodeBetweenLayers': '42',
        'elk.spacing.edgeNode': '28',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
        'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'elk.separateConnectedComponents': 'true',
        'elk.spacing.componentComponent': '160',
      },
      children,
      edges,
    },
    rfEdges,
    records,
  };
}

function buildNeighbours(edges: Edge[]): Map<string, Set<string>> {
  const neighbours = new Map<string, Set<string>>();
  for (const edge of edges) {
    const sourceSet = neighbours.get(edge.source) ?? new Set<string>();
    sourceSet.add(edge.target);
    neighbours.set(edge.source, sourceSet);

    const targetSet = neighbours.get(edge.target) ?? new Set<string>();
    targetSet.add(edge.source);
    neighbours.set(edge.target, targetSet);
  }
  return neighbours;
}

function collectComponents(records: Map<string, LayoutRecord>, edges: Edge[]): string[][] {
  const neighbours = buildNeighbours(edges);
  const seen = new Set<string>();
  const components: string[][] = [];

  for (const id of records.keys()) {
    if (seen.has(id)) continue;
    const component: string[] = [];
    const queue = [id];
    seen.add(id);
    while (queue.length > 0) {
      const current = queue.pop() as string;
      component.push(current);
      for (const next of neighbours.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    components.push(component);
  }

  return components;
}

function alignComponents(
  rawNodes: Node<TreeLayoutNodeData>[],
  data: TreeNode[],
  edges: Edge[],
): Node<TreeLayoutNodeData>[] {
  const byId = new Map(rawNodes.map((node) => [node.id, node]));
  const components = collectComponents(
    new Map(rawNodes.map((node) => [node.id, {
      id: node.id,
      kind: node.data.kind,
      width: node.width ?? 0,
      height: node.height ?? 0,
    }])),
    edges,
  );
  const componentIds = components.length > 0 ? components : rawNodes.map((node) => [node.id]);
  const componentLayouts = componentIds.map((ids) => {
    const nodes = ids
      .map((id) => byId.get(id))
      .filter((node): node is Node<TreeLayoutNodeData> => Boolean(node));
    const persons = nodes.filter((node): node is Node<PersonNodeData> => node.data.kind === 'person');
    const minX = Math.min(...nodes.map((node) => node.position.x), 0);
    const maxX = Math.max(
      ...nodes.map((node) => node.position.x + (node.width ?? 0)),
      PERSON_NODE_WIDTH,
    );
    const baselineCandidates = persons
      .filter((node) => {
        const person = data.find((item) => item.id === node.id);
        return person ? person.rels.parents.length === 0 : false;
      })
      .map((node) => node.position.y);
    const rootBaseline = baselineCandidates.length > 0 ? Math.max(...baselineCandidates) : Math.max(...nodes.map((node) => node.position.y));
    const orderAnchor = persons.length > 0
      ? persons.reduce((sum, node) => sum + node.position.x + (node.width ?? PERSON_NODE_WIDTH) / 2, 0) / persons.length
      : minX;

    return { nodes, minX, maxX, width: maxX - minX, rootBaseline, orderAnchor };
  });

  const globalBaseline = Math.max(...componentLayouts.map((component) => component.rootBaseline), 0);
  componentLayouts.sort((a, b) => a.orderAnchor - b.orderAnchor);

  let currentX = 0;
  for (const component of componentLayouts) {
    const shiftX = currentX - component.minX;
    const shiftY = globalBaseline - component.rootBaseline;
    for (const node of component.nodes) {
      node.position.x += shiftX;
      node.position.y += shiftY;
    }
    currentX += component.width + COMPONENT_GAP_X;
  }

  return rawNodes;
}

export async function layoutTree(
  data: TreeNode[],
): Promise<{ nodes: Node<TreeLayoutNodeData>[]; edges: Edge<TreeEdgeData>[] }> {
  if (data.length === 0) return { nodes: [], edges: [] };

  const { elkNode, rfEdges, records } = buildElkGraph(data);
  const laid = await elk.layout(elkNode);

  const nodes: Node<TreeLayoutNodeData>[] = (laid.children ?? []).map((child) => {
    const record = records.get(child.id)!;
    if (record.kind === 'family') {
      return {
        id: child.id,
        type: 'family',
        position: { x: child.x ?? 0, y: child.y ?? 0 },
        data: {
          kind: 'family',
          parentIds: record.family?.parentIds ?? [],
          childIds: record.family?.childIds ?? [],
        },
        width: FAMILY_NODE_WIDTH,
        height: FAMILY_NODE_HEIGHT,
      };
    }

    return {
      id: child.id,
      type: 'person',
      position: { x: child.x ?? 0, y: child.y ?? 0 },
      data: {
        kind: 'person',
        label: formatShortName(record.person!.data),
        status: record.person!.data.status,
          isRootGeneration: record.person!.rels.parents.length === 0,
          hasChildren: record.person!.rels.children.length > 0,
      },
      width: PERSON_NODE_WIDTH,
      height: PERSON_NODE_HEIGHT,
    };
  });

  const alignedNodes = alignComponents(nodes, data, rfEdges);
  return { nodes: alignedNodes, edges: rfEdges };
}
