import { BaseEdge, getBezierPath, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { TreeEdgeData, TreeEdgeKind } from './elkLayoutAdapter';

const SHADOW_EXTRA: Record<TreeEdgeKind, number> = {
  root: 2.4,
  branch: 1.5,
  leafStem: 0.9,
};

const ALIGNED_PX = 12;
const FORK_MAX_DX = 140;

function buildTreePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: EdgeProps['sourcePosition'],
  targetPosition: EdgeProps['targetPosition'],
): string {
  const dx = Math.abs(targetX - sourceX);
  if (dx <= ALIGNED_PX) {
    return `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  }
  if (dx <= FORK_MAX_DX) {
    const [path] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 8,
      offset: 0,
    });
    return path;
  }
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return path;
}

export function OrganicTreeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}: EdgeProps) {
  const edgeKind = ((data as TreeEdgeData | undefined)?.kind ?? 'branch') as TreeEdgeKind;
  const path = buildTreePath(sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition);
  const width = typeof style?.strokeWidth === 'number' ? style.strokeWidth : 2.2;

  return (
    <>
      <BaseEdge
        id={`${id}-shadow`}
        path={path}
        className={`tree-edge tree-edge-shadow tree-edge--${edgeKind}`}
        style={{ strokeWidth: width + SHADOW_EXTRA[edgeKind] }}
        interactionWidth={0}
      />
      <BaseEdge
        id={id}
        path={path}
        className={`tree-edge tree-edge-main tree-edge--${edgeKind}`}
        style={{ strokeWidth: width }}
        interactionWidth={0}
      />
    </>
  );
}
