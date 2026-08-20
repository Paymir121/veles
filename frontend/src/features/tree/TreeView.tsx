import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Controls,
  Background,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type Node,
  type NodeMouseHandler,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTree } from './hooks';
import { layoutTree, type TreeLayoutNodeData } from './elkLayoutAdapter';
import { FamilyNode, PersonNode } from './PersonNode';
import { DEFAULT_EDGE_STROKE_WIDTH, getEdgeStrokeWidth, scaleEdgeStrokeWidth } from './treeAppearance';

const nodeTypes = { person: PersonNode, family: FamilyNode };

interface TreeViewProps {
  focusPersonId?: string;
  showPhotos?: boolean;
}

function applyShowPhotos(
  nodes: Node<TreeLayoutNodeData>[],
  showPhotos: boolean,
): Node<TreeLayoutNodeData>[] {
  return nodes.map((node) =>
    node.data.kind === 'person'
      ? { ...node, data: { ...node.data, showPhotos } }
      : node,
  );
}

function TreeViewInner({ focusPersonId, showPhotos = false }: TreeViewProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useTree();
  const [edgeStrokeWidth] = useState(getEdgeStrokeWidth);
  const draggingNodeRef = useRef(false);
  const { fitView } = useReactFlow();

  const graph = useMemo(() => layoutTree(data ?? []), [data]);
  const [draggedNodes, setDraggedNodes] = useState<Node<TreeLayoutNodeData>[] | null>(null);
  const [layoutSource, setLayoutSource] = useState(graph);

  if (graph !== layoutSource) {
    setLayoutSource(graph);
    setDraggedNodes(null);
  }

  const nodes = draggedNodes ?? graph.nodes;

  const displayNodes = useMemo(
    () => applyShowPhotos(nodes, showPhotos),
    [nodes, showPhotos],
  );

  const displayEdges = useMemo(
    () =>
      graph.edges.map((edge) => {
        const baseWidth =
          typeof edge.style?.strokeWidth === 'number'
            ? edge.style.strokeWidth
            : DEFAULT_EDGE_STROKE_WIDTH;
        return {
          ...edge,
          style: {
            ...edge.style,
            strokeWidth: scaleEdgeStrokeWidth(baseWidth, edgeStrokeWidth),
          },
        };
      }),
    [graph.edges, edgeStrokeWidth],
  );

  useEffect(() => {
    if (graph.nodes.length === 0) return;
    if (focusPersonId && graph.nodes.some((n) => n.id === focusPersonId)) {
      requestAnimationFrame(() => {
        fitView({ nodes: [{ id: focusPersonId }], duration: 400, padding: 0.2 });
      });
    } else {
      requestAnimationFrame(() => {
        fitView({ duration: 300, padding: 0.02 });
      });
    }
  }, [focusPersonId, fitView, graph]);

  const onNodesChange = useCallback<OnNodesChange<Node<TreeLayoutNodeData>>>((changes) => {
    setDraggedNodes((current) => applyNodeChanges(changes, current ?? graph.nodes));
  }, [graph.nodes]);

  const onNodeClick = useCallback<NodeMouseHandler<Node<TreeLayoutNodeData>>>(
    (_event, node) => {
      if (draggingNodeRef.current) return;
      if (node.data.kind !== 'person') return;
      navigate(`/person/${node.id}`);
    },
    [navigate],
  );

  if (isLoading) return <p className="text-text-muted p-6">Загрузка дерева...</p>;
  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-text-muted">
        <p>Не удалось загрузить дерево.</p>
        <button type="button" className="btn btn-secondary" onClick={() => void refetch()}>
          Повторить
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <p>В дереве пока нет ни одного человека.</p>
      </div>
    );
  }

  return (
    <div className="tree-view-container">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={() => {}}
        onNodeClick={onNodeClick}
        onNodeDragStart={() => {
          draggingNodeRef.current = true;
        }}
        onNodeDragStop={() => {
          requestAnimationFrame(() => {
            draggingNodeRef.current = false;
          });
        }}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable
        nodesConnectable={false}
        nodeDragThreshold={5}
        deleteKeyCode={null}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Controls showInteractive={false} />
        <Background />
      </ReactFlow>
    </div>
  );
}

export function TreeView(props: TreeViewProps) {
  return (
    <ReactFlowProvider>
      <TreeViewInner {...props} />
    </ReactFlowProvider>
  );
}
