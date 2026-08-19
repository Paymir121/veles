import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TreeNode } from '@/shared/types';
import { useTree } from './hooks';
import { createFamilyChart, type FamilyChartHandle } from './familyChartAdapter';

interface TreeViewProps {
  /** Person the chart is centred on. family-chart draws one bloodline at a
   *  time around this id, so changing it is how the whole graph stays
   *  reachable (see PeoplePanel). */
  centeredId?: string;
}

export function TreeView({ centeredId }: TreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartHandleRef = useRef<FamilyChartHandle | null>(null);
  // What the chart currently reflects, so a re-centre doesn't redraw the data
  // and a data refetch doesn't reset the centre.
  const appliedDataRef = useRef<TreeNode[] | null>(null);
  const appliedCenterRef = useRef<string | undefined>(undefined);
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useTree();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data || data.length === 0) return;

    if (!chartHandleRef.current) {
      chartHandleRef.current = createFamilyChart({
        container,
        data,
        mainId: centeredId,
        onCardClick: (personId) => navigate(`/person/${personId}`),
      });
      appliedDataRef.current = data;
      appliedCenterRef.current = centeredId;
      return;
    }

    if (appliedDataRef.current !== data) {
      chartHandleRef.current.updateData(data);
      appliedDataRef.current = data;
    }
    if (centeredId && centeredId !== appliedCenterRef.current) {
      chartHandleRef.current.focusOnPerson(centeredId);
      appliedCenterRef.current = centeredId;
    }
  }, [data, navigate, centeredId]);

  useEffect(() => {
    return () => {
      chartHandleRef.current?.destroy();
      chartHandleRef.current = null;
      appliedDataRef.current = null;
      appliedCenterRef.current = undefined;
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
}
