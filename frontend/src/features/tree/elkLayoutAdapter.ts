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
const FAMILY_NODE_WIDTH = 18;
const FAMILY_NODE_HEIGHT = 8;
const VIRTUAL_NODE_SIZE = 2;
const COMPONENT_GAP_X = 110;
const VIRTUAL_ID_PREFIX = 'virtual:';

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
  virtualIds: Set<string>;
  sourceData: TreeNode[];
}

function isVirtualId(id: string): boolean {
  return id.startsWith(VIRTUAL_ID_PREFIX);
}

function createVirtualPerson(id: string, parents: string[], children: string[]): TreeNode {
  return {
    id,
    data: {
      first_name: '',
      last_name: '',
      patronymic: '',
      gender: 'M',
      gender_actual: 'M',
      birth_date: '',
      death_date: '',
      status: 'deceased',
      avatar: null,
    },
    rels: { parents, spouses: [], children },
  };
}

function isTrueRoot(person: TreeNode, byId: Map<string, TreeNode>): boolean {
  if (person.rels.parents.length > 0) return false;
  if (person.rels.spouses.some((spouseId) => {
    const spouse = byId.get(spouseId);
    return spouse && spouse.rels.parents.length === 0;
  })) return true;

  for (const childId of person.rels.children) {
    const child = byId.get(childId);
    if (!child) continue;
    for (const parentId of child.rels.parents) {
      if (parentId === person.id) continue;
      const coParent = byId.get(parentId);
      if (coParent && coParent.rels.parents.length > 0) return false;
    }
  }

  for (const spouseId of person.rels.spouses) {
    const spouse = byId.get(spouseId);
    if (spouse && spouse.rels.parents.length > 0) return false;
  }

  return true;
}

function inferTargetGeneration(
  person: TreeNode,
  byId: Map<string, TreeNode>,
  generations: Map<string, number>,
): number {
  for (const childId of person.rels.children) {
    const child = byId.get(childId);
    if (!child) continue;
    for (const parentId of child.rels.parents) {
      if (parentId === person.id) continue;
      const coParentGeneration = generations.get(parentId);
      if (coParentGeneration !== undefined) return coParentGeneration;
    }
  }

  for (const spouseId of person.rels.spouses) {
    const spouseGeneration = generations.get(spouseId);
    if (spouseGeneration !== undefined) return spouseGeneration;
  }

  if (person.rels.children.length > 0) {
    const childGenerations = person.rels.children
      .map((childId) => generations.get(childId))
      .filter((generation): generation is number => generation !== undefined);
    if (childGenerations.length > 0) return Math.min(...childGenerations) - 1;
  }

  return 1;
}

function augmentWithVirtualParents(data: TreeNode[]): { nodes: TreeNode[]; virtualIds: Set<string> } {
  const byId = new Map(data.map((node) => [node.id, node]));
  const generations = assignGenerations(data);
  const virtualIds = new Set<string>();
  const nodes = data.map((person) => ({
    ...person,
    rels: {
      parents: [...person.rels.parents],
      spouses: [...person.rels.spouses],
      children: [...person.rels.children],
    },
  }));
  const extra: TreeNode[] = [];

  for (const person of nodes) {
    if (person.rels.parents.length > 0) continue;
    if (isTrueRoot(person, byId)) continue;

    const targetGeneration = Math.max(inferTargetGeneration(person, byId, generations), 1);
    const chainIds = Array.from(
      { length: targetGeneration },
      (_, level) => `${VIRTUAL_ID_PREFIX}chain:${person.id}:${level}`,
    );

    for (let level = 0; level < targetGeneration; level += 1) {
      const virtualId = chainIds[level];
      virtualIds.add(virtualId);
      extra.push(createVirtualPerson(
        virtualId,
        level === 0 ? [] : [chainIds[level - 1]],
        level === targetGeneration - 1 ? [person.id] : [chainIds[level + 1]],
      ));
    }

    person.rels.parents = [chainIds[targetGeneration - 1]];
  }

  return { nodes: [...nodes, ...extra], virtualIds };
}

function pickHandleId(
  index: number,
  total: number,
  side: 'personSource' | 'familyTarget' | 'childTarget' | 'familySource',
): string {
  const personSources = ['top-left', 'top-center', 'top-right'] as const;
  const familyTargets = ['bottom-left', 'bottom-center', 'bottom-right'] as const;
  const childTargets = ['bottom-left', 'bottom-center', 'bottom-right'] as const;
  const familySources = ['top-left', 'top-center', 'top-right'] as const;
  const handles = side === 'personSource'
    ? personSources
    : side === 'familyTarget'
      ? familyTargets
      : side === 'childTarget'
        ? childTargets
        : familySources;
  if (total <= 1) return handles[1];
  const slot = Math.round((index / Math.max(total - 1, 1)) * (handles.length - 1));
  return handles[slot];
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
  const parentsKey = parentIds.length > 0 ? [...parentIds].sort().join('+') : `unknown-${childId}`;
  return `family:${parentsKey}`;
}

function coreRootSurnames(data: TreeNode[]): Set<string> {
  const byId = new Map(data.map((person) => [person.id, person]));
  return new Set(
    data
      .filter((person) => person.rels.parents.length === 0 && isTrueRoot(person, byId))
      .map((person) => person.data.last_name),
  );
}

/** 0 = core tree (Loginov/Romanov/Nelzin…); 1 = marriage-in branch (e.g. Begeshev via Natalya). */
function familyBranchRank(
  family: FamilyUnit,
  sourceById: Map<string, TreeNode>,
  coreSurnames: Set<string>,
): number {
  for (const parentId of family.parentIds) {
    if (isVirtualId(parentId)) continue;
    const parent = sourceById.get(parentId);
    if (!parent || parent.rels.parents.length > 0) continue;
    if (isTrueRoot(parent, sourceById)) continue;
    if (!coreSurnames.has(parent.data.last_name)) return 1;
  }
  return 0;
}

function compareFamilyOrder(
  leftFamilyId: string,
  rightFamilyId: string,
  branchRanks: Map<string, number>,
  tieBreaker: Map<string, number>,
  sourceById?: Map<string, TreeNode>,
  coreSurnames?: Set<string>,
): number {
  const leftRank = groupBranchRank(leftFamilyId, branchRanks, sourceById, coreSurnames);
  const rightRank = groupBranchRank(rightFamilyId, branchRanks, sourceById, coreSurnames);
  if (leftRank !== rightRank) return leftRank - rightRank;
  return (tieBreaker.get(leftFamilyId) ?? 0) - (tieBreaker.get(rightFamilyId) ?? 0);
}

function groupBranchRank(
  groupId: string,
  branchRanks: Map<string, number>,
  sourceById?: Map<string, TreeNode>,
  coreSurnames?: Set<string>,
): number {
  if (branchRanks.has(groupId)) return branchRanks.get(groupId) as number;
  const person = sourceById?.get(groupId);
  if (!person || !coreSurnames || !sourceById) return 0;
  if (person.rels.parents.length > 0) return 0;
  if (isTrueRoot(person, sourceById)) return 0;
  return coreSurnames.has(person.data.last_name) ? 0 : 1;
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

function buildElkGraph(data: TreeNode[]): BuiltGraph {
  const { nodes: layoutData, virtualIds } = augmentWithVirtualParents(data);
  const records = new Map<string, LayoutRecord>();
  const children: ElkNode[] = [];
  const edges: ElkExtendedEdge[] = [];
  const rfEdges: Edge<TreeEdgeData>[] = [];
  const edgeSet = new Set<string>();
  const families = buildFamilyUnits(layoutData);
  const byId = new Map(layoutData.map((person) => [person.id, person]));
  const sourceById = new Map(data.map((person) => [person.id, person]));
  const sourceFamilies = buildFamilyUnits(data);
  const coreSurnames = coreRootSurnames(data);
  const familyBranchRanks = new Map(
    sourceFamilies.map((family) => [family.id, familyBranchRank(family, sourceById, coreSurnames)]),
  );
  const familyTieBreak = new Map(sourceFamilies.map((family, index) => [family.id, index]));
  const generations = assignGenerations(data);
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

  for (const person of layoutData) {
    const isVirtual = virtualIds.has(person.id);
    records.set(person.id, {
      id: person.id,
      kind: 'person',
      width: isVirtual ? VIRTUAL_NODE_SIZE : PERSON_NODE_WIDTH,
      height: isVirtual ? VIRTUAL_NODE_SIZE : PERSON_NODE_HEIGHT,
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
      const aGeneration = generations.get(a.id) ?? 0;
      const bGeneration = generations.get(b.id) ?? 0;
      if (aGeneration !== bGeneration) return aGeneration - bGeneration;

      const aFamilyGroup = resolvePersonFamilyGroup(
        a.id,
        aGeneration,
        sourceFamilies,
        generations,
        sourceById,
        familyBranchRanks,
      );
      const bFamilyGroup = resolvePersonFamilyGroup(
        b.id,
        bGeneration,
        sourceFamilies,
        generations,
        sourceById,
        familyBranchRanks,
      );
      const familyOrder = compareFamilyOrder(
        aFamilyGroup,
        bFamilyGroup,
        familyBranchRanks,
        familyTieBreak,
        sourceById,
        coreSurnames,
      );
      if (familyOrder !== 0) return familyOrder;
      if (aFamilyGroup !== bFamilyGroup) return aFamilyGroup.localeCompare(bFamilyGroup);

      return a.id.localeCompare(b.id);
    }

    if (a.kind === 'family' && b.kind === 'family') {
      const aChildGeneration = Math.min(...(a.family?.childIds.map((id) => generations.get(id) ?? 0) ?? [0]));
      const bChildGeneration = Math.min(...(b.family?.childIds.map((id) => generations.get(id) ?? 0) ?? [0]));
      if (aChildGeneration !== bChildGeneration) return aChildGeneration - bChildGeneration;
      const familyOrder = compareFamilyOrder(a.id, b.id, familyBranchRanks, familyTieBreak, sourceById, coreSurnames);
      if (familyOrder !== 0) return familyOrder;
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
      const parentFamilies = familiesByParent.get(parentId) ?? [family];
      const familyIndexForParent = parentFamilies.findIndex((item) => item.id === family.id);
      const parentHandleId = pickHandleId(
        familyIndexForParent >= 0 ? familyIndexForParent : 0,
        parentFamilies.length,
        'personSource',
      );
      const familyTargetHandleId = pickHandleId(
        family.parentIds.findIndex((id) => id === parentId),
        family.parentIds.length,
        'familyTarget',
      );
      const edgeId = `e-${parentId}-${family.id}`;
      if (edgeSet.has(edgeId)) continue;
      edgeSet.add(edgeId);
      edges.push({ id: edgeId, sources: [parentId], targets: [family.id] });
      if (virtualIds.has(parentId)) continue;
      rfEdges.push({
        id: edgeId,
        source: parentId,
        target: family.id,
        sourceHandle: parentHandleId,
        targetHandle: familyTargetHandleId,
        type: 'straight',
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

    const sortedChildIds = [...family.childIds].sort();
    for (const childId of family.childIds) {
      if (!records.has(childId)) continue;
      const childIndex = sortedChildIds.indexOf(childId);
      const edgeId = `e-${family.id}-${childId}`;
      if (edgeSet.has(edgeId)) continue;
      edgeSet.add(edgeId);
      edges.push({ id: edgeId, sources: [family.id], targets: [childId] });
      if (virtualIds.has(childId)) continue;
      rfEdges.push({
        id: edgeId,
        source: family.id,
        target: childId,
        sourceHandle: 'top-center',
        targetHandle: pickHandleId(childIndex, sortedChildIds.length, 'childTarget'),
        data: { kind: getEdgeKindToPerson(byId.get(childId) as TreeNode) },
        type: 'straight',
        style: edgeStyleForKind(getEdgeKindToPerson(byId.get(childId) as TreeNode)),
      });
    }
  }

  for (const node of layoutData) {
    for (const spouseId of node.rels.spouses) {
      if (!records.has(spouseId) || node.id >= spouseId) continue;
      if (virtualIds.has(node.id) || virtualIds.has(spouseId)) continue;
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
    virtualIds,
    sourceData: data,
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

function resolvePersonFamilyGroup(
  personId: string,
  layerGeneration: number,
  families: FamilyUnit[],
  generations: Map<string, number>,
  sourceById: Map<string, TreeNode>,
  branchRanks: Map<string, number>,
): string {
  const parentFamilies = families.filter((family) => family.parentIds.includes(personId));
  const childFamilies = families.filter((family) => family.childIds.includes(personId));

  const parentAtLayer = parentFamilies.find((family) => {
    const childGeneration = Math.min(...family.childIds.map((id) => generations.get(id) ?? 0));
    return childGeneration - 1 === layerGeneration;
  });
  if (parentAtLayer) return parentAtLayer.id;

  const sideParent = parentFamilies.find((family) => (branchRanks.get(family.id) ?? 0) === 1);
  if (sideParent && (generations.get(personId) ?? 0) === layerGeneration) {
    return sideParent.id;
  }

  const childAtLayer = childFamilies.find((family) => {
    const childGeneration = Math.min(...family.childIds.map((id) => generations.get(id) ?? 0));
    return childGeneration === layerGeneration;
  });
  if (childAtLayer) return childAtLayer.id;

  const person = sourceById.get(personId);
  if (person && person.rels.parents.length > 0 && (generations.get(personId) ?? 0) === layerGeneration) {
    const birthFamily = childFamilies[0];
    if (birthFamily) return birthFamily.id;
  }

  return personId;
}

const REPACK_SIBLING_GAP = 40;
const REPACK_BRANCH_GAP = 88;
const LAYER_Y_TOLERANCE = 55;

function centerFamilyNodes(nodes: Node<TreeLayoutNodeData>[], sourceData: TreeNode[]): void {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  for (const family of buildFamilyUnits(sourceData)) {
    const familyNode = byId.get(family.id);
    if (!familyNode || familyNode.data.kind !== 'family') continue;

    const parents = family.parentIds
      .map((id) => byId.get(id))
      .filter((node): node is Node<PersonNodeData> => node?.data.kind === 'person');
    const children = family.childIds
      .map((id) => byId.get(id))
      .filter((node): node is Node<PersonNodeData> => node?.data.kind === 'person');
    if (parents.length === 0 || children.length === 0) continue;

    const parentCenterX = parents.reduce(
      (sum, parent) => sum + parent.position.x + PERSON_NODE_WIDTH / 2,
      0,
    ) / parents.length;
    const childCenterX = children.reduce(
      (sum, child) => sum + child.position.x + PERSON_NODE_WIDTH / 2,
      0,
    ) / children.length;
    const parentBottom = Math.max(...parents.map((parent) => parent.position.y + PERSON_NODE_HEIGHT));
    const childTop = Math.min(...children.map((child) => child.position.y));

    familyNode.position.x = (parentCenterX + childCenterX) / 2 - FAMILY_NODE_WIDTH / 2;
    familyNode.position.y = parentBottom + (childTop - parentBottom) / 2 - FAMILY_NODE_HEIGHT / 2;
  }
}

export async function layoutTree(
  data: TreeNode[],
): Promise<{ nodes: Node<TreeLayoutNodeData>[]; edges: Edge<TreeEdgeData>[] }> {
  if (data.length === 0) return { nodes: [], edges: [] };

  const { elkNode, rfEdges, records, virtualIds, sourceData } = buildElkGraph(data);
  const laid = await elk.layout(elkNode);

  const nodes: Node<TreeLayoutNodeData>[] = (laid.children ?? [])
    .filter((child) => {
      if (virtualIds.has(child.id)) return false;
      const record = records.get(child.id);
      if (record?.kind !== 'family') return true;
      const family = record.family;
      if (!family) return false;
      return !family.parentIds.some(isVirtualId) && !family.childIds.some(isVirtualId);
    })
    .map((child) => {
    const record = records.get(child.id)!;
    if (record.kind === 'family') {
      return {
        id: child.id,
        type: 'family',
        position: { x: child.x ?? 0, y: child.y ?? 0 },
        data: {
          kind: 'family',
          parentIds: record.family?.parentIds.filter((id) => !isVirtualId(id)) ?? [],
          childIds: record.family?.childIds.filter((id) => !isVirtualId(id)) ?? [],
        },
        width: FAMILY_NODE_WIDTH,
        height: FAMILY_NODE_HEIGHT,
      };
    }

    const sourcePerson = sourceData.find((item) => item.id === child.id);
    return {
      id: child.id,
      type: 'person',
      position: { x: child.x ?? 0, y: child.y ?? 0 },
      data: {
        kind: 'person',
        label: formatShortName(record.person!.data),
        status: record.person!.data.status,
        isRootGeneration: sourcePerson ? sourcePerson.rels.parents.length === 0 : false,
        hasChildren: record.person!.rels.children.length > 0,
      },
      width: PERSON_NODE_WIDTH,
      height: PERSON_NODE_HEIGHT,
    };
  });

  const alignedNodes = alignComponents(nodes, sourceData, rfEdges);
  centerFamilyNodes(alignedNodes, sourceData);
  return { nodes: alignedNodes, edges: rfEdges };
}
