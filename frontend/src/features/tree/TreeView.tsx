import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTree } from './hooks';
import { createFamilyChart, type FamilyChartHandle } from './familyChartAdapter';

export interface TreeViewHandle {
  focusOnPerson: (id: string) => void;
}

// Renders the family-chart tree from useTree() (GET /api/tree/). Exposes an
// imperative `focusOnPerson` handle so TreePage can wire up search results
// without TreeView needing to know anything about the search feature.
export const TreeView = forwardRef<TreeViewHandle>(function TreeView(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartHandleRef = useRef<FamilyChartHandle | null>(null);
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useTree();

  useImperativeHandle(ref, () => ({
    focusOnPerson: (id: string) => {
      chartHandleRef.current?.focusOnPerson(id);
    },
  }));

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return;

    if (!chartHandleRef.current) {
      chartHandleRef.current = createFamilyChart({
        container: containerRef.current,
        data,
        onCardClick: (personId) => navigate(`/person/${personId}`),
      });
    } else {
      chartHandleRef.current.updateData(data);
    }
  }, [data, navigate]);

  // Unmount cleanup only (empty deps) - tears down the D3/family-chart DOM
  // tree when TreePage itself unmounts (e.g. navigating away).
  useEffect(() => {
    return () => {
      chartHandleRef.current?.destroy();
      chartHandleRef.current = null;
    };
  }, []);

  if (isLoading) return <p>Загрузка дерева...</p>;
  if (isError) {
    return (
      <div className="tree-empty-state">
        <p>Не удалось загрузить дерево.</p>
        <button type="button" onClick={() => void refetch()}>
          Повторить
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="tree-empty-state">
        <p>В дереве пока нет ни одного человека.</p>
      </div>
    );
  }

  return <div className="tree-view-container" ref={containerRef} />;
});
