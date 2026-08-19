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
  type Edge,
  type NodeMouseHandler,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { TreeNode } from '@/shared/types';
import { useTree } from './hooks';
import { layoutTree, type TreeEdgeData, type TreeLayoutNodeData } from './elkLayoutAdapter';
import { FamilyNode, PersonNode } from './PersonNode';
import { DEFAULT_EDGE_STROKE_WIDTH, getEdgeStrokeWidth, scaleEdgeStrokeWidth } from './treeAppearance';

const nodeTypes = { person: PersonNode, family: FamilyNode };

interface TreeViewProps {
  focusPersonId?: string;
  showPhotos?: boolean;
}

interface TreeLayoutState {
  source: TreeNode[] | null;
  nodes: Node<TreeLayoutNodeData>[];
  edges: Edge<TreeEdgeData>[];
  error: boolean;
}

const emptyLayout: TreeLayoutState = {
  source: null,
  nodes: [],
  edges: [],
  error: false,
};

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
  const [layout, setLayout] = useState<TreeLayoutState>(emptyLayout);
  const [edgeStrokeWidth] = useState(getEdgeStrokeWidth);
  const draggingNodeRef = useRef(false);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!data || data.length === 0) return;

    let cancelled = false;

    layoutTree(data)
      .then((result) => {
        if (cancelled) return;
        setLayout({
          source: data,
          nodes: result.nodes,
          edges: result.edges,
          error: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLayout({
          source: data,
          nodes: [],
          edges: [],
          error: true,
        });
      });

    return () => { cancelled = true; };
  }, [data]);

  const displayNodes = useMemo(
    () => applyShowPhotos(layout.nodes, showPhotos),
    [layout.nodes, showPhotos],
  );

  const displayEdges = useMemo(
    () =>
      layout.edges.map((edge) => {
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
    [layout.edges, edgeStrokeWidth],
  );

  const layoutReady = Boolean(
    data && data.length > 0 && layout.source === data && !layout.error && layout.nodes.length > 0,
  );
  const layoutError = Boolean(data && data.length > 0 && layout.source === data && layout.error);
  const layoutLoading = Boolean(data && data.length > 0 && layout.source !== data);

  const retryLayout = useCallback(() => {
    if (!data || data.length === 0) return;
    setLayout((current) => ({ ...current, source: null, error: false }));
    void layoutTree(data)
      .then((result) => {
        setLayout({
          source: data,
          nodes: result.nodes,
          edges: result.edges,
          error: false,
        });
      })
      .catch(() => {
        setLayout({
          source: data,
          nodes: [],
          edges: [],
          error: true,
        });
      });
  }, [data]);

  useEffect(() => {
    if (!layoutReady || layout.nodes.length === 0) return;
    if (focusPersonId && layout.nodes.some((n) => n.id === focusPersonId)) {
      requestAnimationFrame(() => {
        fitView({ nodes: [{ id: focusPersonId }], duration: 400, padding: 0.2 });
      });
    } else {
      requestAnimationFrame(() => {
        fitView({ duration: 300, padding: 0.02 });
      });
    }
  }, [layoutReady, focusPersonId, fitView, layout.source, layout.nodes.length]);

  const onNodesChange = useCallback<OnNodesChange<Node<TreeLayoutNodeData>>>((changes) => {
    setLayout((current) => ({
      ...current,
      nodes: applyNodeChanges(changes, current.nodes),
    }));
  }, []);

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

  if (layoutError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-text-muted">
        <p>Не удалось построить дерево.</p>
        <button type="button" className="btn btn-secondary" onClick={retryLayout}>
          Повторить
        </button>
      </div>
    );
  }

  if (layoutLoading) {
    return <p className="text-text-muted p-6">Построение дерева...</p>;
  }

  if (!layoutReady) {
    return <p className="text-text-muted p-6">Построение дерева...</p>;
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
