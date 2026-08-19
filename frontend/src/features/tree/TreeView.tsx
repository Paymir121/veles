import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTree } from './hooks';
import { layoutTree, type TreeEdgeData, type TreeLayoutNodeData } from './elkLayoutAdapter';
import { FamilyNode, PersonNode } from './PersonNode';

const nodeTypes = { person: PersonNode, family: FamilyNode };

interface TreeViewProps {
  focusPersonId?: string;
  showPhotos?: boolean;
}

function TreeViewInner({ focusPersonId, showPhotos = false }: TreeViewProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useTree();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TreeLayoutNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<TreeEdgeData>>([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const [layoutError, setLayoutError] = useState(false);
  const { fitView } = useReactFlow();
  const showPhotosRef = useRef(showPhotos);

  useEffect(() => {
    showPhotosRef.current = showPhotos;
  }, [showPhotos]);

  useEffect(() => {
    if (!data || data.length === 0) {
      setNodes([]);
      setEdges([]);
      setLayoutReady(false);
      setLayoutError(false);
      return;
    }

    let cancelled = false;
    setLayoutReady(false);
    setLayoutError(false);

    layoutTree(data)
      .then((result) => {
        if (cancelled) return;
        setNodes(result.nodes.map((node) => (
          node.data.kind === 'person'
            ? { ...node, data: { ...node.data, showPhotos: showPhotosRef.current } }
            : node
        )));
        setEdges(result.edges);
        setLayoutReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLayoutError(true);
      });

    return () => { cancelled = true; };
  }, [data]);

  useEffect(() => {
    setNodes((current) => {
      let changed = false;
      const next = current.map((node) => {
        if (node.data.kind === 'person' && node.data.showPhotos !== showPhotos) {
          changed = true;
          return { ...node, data: { ...node.data, showPhotos } };
        }
        return node;
      });
      return changed ? next : current;
    });
  }, [showPhotos]);

  useEffect(() => {
    if (!layoutReady || nodes.length === 0) return;
    if (focusPersonId && nodes.some((n) => n.id === focusPersonId)) {
      requestAnimationFrame(() => {
        fitView({ nodes: [{ id: focusPersonId }], duration: 400, padding: 0.2 });
      });
    } else {
      requestAnimationFrame(() => {
        fitView({ duration: 300, padding: 0.02 });
      });
    }
  }, [layoutReady, focusPersonId, fitView, nodes]);

  const onNodeClick = useCallback<NodeMouseHandler<Node<TreeLayoutNodeData>>>(
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
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <p>В дереве пока нет ни одного человека.</p>
      </div>
    );
  }

  if (layoutError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-text-muted">
        <p>Не удалось построить дерево.</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setLayoutError(false);
            setLayoutReady(false);
            void layoutTree(data)
              .then((result) => {
                setNodes(result.nodes.map((node) => (
                  node.data.kind === 'person'
                    ? { ...node, data: { ...node.data, showPhotos } }
                    : node
                )));
                setEdges(result.edges);
                setLayoutReady(true);
              })
              .catch(() => setLayoutError(true));
          }}
        >
          Повторить
        </button>
      </div>
    );
  }

  if (!layoutReady) {
    return <p className="text-text-muted p-6">Построение дерева...</p>;
  }

  return (
    <div className="tree-view-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
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
