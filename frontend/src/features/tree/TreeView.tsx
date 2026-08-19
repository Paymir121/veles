import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTree } from './hooks';
import { createFamilyChart, type FamilyChartHandle } from './familyChartAdapter';

export interface TreeViewHandle {
  focusOnPerson: (id: string) => void;
}

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

  useEffect(() => {
    return () => {
      chartHandleRef.current?.destroy();
      chartHandleRef.current = null;
    };
  }, []);

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

  return <div className="tree-view-container" ref={containerRef} />;
});
