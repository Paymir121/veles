import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/useAuthStore';
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

/** Keep a focused card close to native size so FIO stays readable. */
const FIT_MAX_ZOOM = 1.1;
const FIT_PADDING = 0.45;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

interface TreeViewProps {
  focusPersonId?: string;
  showPhotos?: boolean;
  onPersonSelect?: (personId: string) => void;
  onPersonEdit?: (personId: string) => void;
}

function applyPersonUi(
  nodes: Node<TreeLayoutNodeData>[],
  showPhotos: boolean,
  selectedId: string | undefined,
  showEdit: boolean,
  onEdit?: (personId: string) => void,
): Node<TreeLayoutNodeData>[] {
  return nodes.map((node) =>
    node.data.kind === 'person'
      ? {
          ...node,
          data: {
            ...node.data,
            showPhotos,
            selected: node.id === selectedId,
            showEdit,
            onEdit,
          },
        }
      : node,
  );
}

function useIsNarrowScreen(): boolean {
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsNarrow(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  return isNarrow;
}

function TreeViewInner({ focusPersonId, showPhotos = true, onPersonSelect, onPersonEdit }: TreeViewProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useTree();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [edgeStrokeWidth] = useState(getEdgeStrokeWidth);
  const draggingNodeRef = useRef(false);
  const { fitView } = useReactFlow();
  const isNarrow = useIsNarrowScreen();

  const graph = useMemo(() => layoutTree(data ?? []), [data]);
  const [draggedNodes, setDraggedNodes] = useState<Node<TreeLayoutNodeData>[] | null>(null);
  const [layoutSource, setLayoutSource] = useState(graph);

  if (graph !== layoutSource) {
    setLayoutSource(graph);
    setDraggedNodes(null);
  }

  const nodes = draggedNodes ?? graph.nodes;

  const displayNodes = useMemo(
    () => applyPersonUi(nodes, showPhotos, focusPersonId, isAuthenticated, onPersonEdit),
    [nodes, showPhotos, focusPersonId, isAuthenticated, onPersonEdit],
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
    const targetId =
      focusPersonId && graph.nodes.some((node) => node.id === focusPersonId)
        ? focusPersonId
        : graph.nodes.find((node) => node.data.kind === 'person')?.id;
    if (!targetId) return;
    requestAnimationFrame(() => {
      fitView({
        nodes: [{ id: targetId }],
        duration: 400,
        padding: FIT_PADDING,
        maxZoom: FIT_MAX_ZOOM,
        minZoom: MIN_ZOOM,
      });
    });
  }, [focusPersonId, fitView, graph]);

  const onNodesChange = useCallback<OnNodesChange<Node<TreeLayoutNodeData>>>((changes) => {
    setDraggedNodes((current) => applyNodeChanges(changes, current ?? graph.nodes));
  }, [graph.nodes]);

  const onNodeClick = useCallback<NodeMouseHandler<Node<TreeLayoutNodeData>>>(
    (_event, node) => {
      if (draggingNodeRef.current) return;
      if (node.data.kind !== 'person') return;
      const target = _event.target as HTMLElement | null;
      if (target?.closest('.person-node-edit')) return;
      onPersonSelect?.(node.id);
      if (isNarrow) navigate(`/person/${node.id}`);
    },
    [onPersonSelect, isNarrow, navigate],
  );

  const onNodeDoubleClick = useCallback<NodeMouseHandler<Node<TreeLayoutNodeData>>>(
    (_event, node) => {
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
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-6">
        <p className="text-text-muted">В дереве пока нет ни одного человека.</p>
        {isAuthenticated ? (
          <Link to="/person/new" className="btn">
            Добавить первого человека
          </Link>
        ) : (
          <p className="text-sm text-text-muted">
            <Link to="/login" className="text-accent hover:underline">Войдите</Link>
            , чтобы добавить первого человека.
          </p>
        )}
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
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStart={() => {
          draggingNodeRef.current = true;
        }}
        onNodeDragStop={() => {
          requestAnimationFrame(() => {
            draggingNodeRef.current = false;
          });
        }}
        nodeTypes={nodeTypes}
        nodesDraggable={!isNarrow}
        nodesConnectable={false}
        nodeDragThreshold={8}
        deleteKeyCode={null}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
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
