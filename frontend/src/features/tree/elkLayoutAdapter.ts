import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';
import type { TreeNode, TreeNodeData } from '@/shared/types';

export interface PersonNodeData extends Record<string, unknown> {
  label: string;
  status: TreeNodeData['status'];
}

const NODE_WIDTH = 120;
const NODE_HEIGHT = 70;

const elk = new ELK();

function buildElkGraph(data: TreeNode[]): { elkNode: ElkNode; rfEdges: Edge[] } {
  const ids = new Set(data.map((n) => n.id));
  const children: ElkNode[] = data.map((node) => ({
    id: node.id,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  }));

  const edges: ElkExtendedEdge[] = [];
  const rfEdges: Edge[] = [];
  const edgeSet = new Set<string>();

  for (const node of data) {
    for (const parentId of node.rels.parents) {
      if (!ids.has(parentId)) continue;
      const edgeId = `e-${parentId}-${node.id}`;
      if (edgeSet.has(edgeId)) continue;
      edgeSet.add(edgeId);
      edges.push({ id: edgeId, sources: [parentId], targets: [node.id] });
      rfEdges.push({ id: edgeId, source: parentId, target: node.id, type: 'smoothstep' });
    }

    for (const spouseId of node.rels.spouses) {
      if (!ids.has(spouseId)) continue;
      const key = [node.id, spouseId].sort().join('--');
      const edgeId = `spouse-${key}`;
      if (edgeSet.has(edgeId)) continue;
      edgeSet.add(edgeId);
      edges.push({ id: edgeId, sources: [node.id], targets: [spouseId] });
      rfEdges.push({
        id: edgeId,
        source: node.id,
        target: spouseId,
        type: 'straight',
        style: { strokeDasharray: '6 3' },
      });
    }
  }

  const elkNode: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': '80',
    },
    children,
    edges,
  };

  return { elkNode, rfEdges };
}

function formatFullName(d: TreeNodeData): string {
  return [d.last_name, d.first_name].filter(Boolean).join(' ') || 'Без имени';
}

export async function layoutTree(
  data: TreeNode[],
): Promise<{ nodes: Node<PersonNodeData>[]; edges: Edge[] }> {
  if (data.length === 0) return { nodes: [], edges: [] };

  const byId = new Map(data.map((n) => [n.id, n]));
  const { elkNode, rfEdges } = buildElkGraph(data);
  const laid = await elk.layout(elkNode);

  const nodes: Node<PersonNodeData>[] = (laid.children ?? []).map((child) => {
    const person = byId.get(child.id)!;
    return {
      id: child.id,
      type: 'person',
      position: { x: child.x ?? 0, y: child.y ?? 0 },
      data: {
        label: formatFullName(person.data),
        status: person.data.status,
      },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  });

  return { nodes, edges: rfEdges };
}
