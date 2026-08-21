import { BaseEdge, type EdgeProps } from '@xyflow/react';
import type { TreeEdgeData } from './elkLayoutAdapter';

function buildOrganicPath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
  const verticalGap = targetY - sourceY;
  const controlOffset = Math.max(Math.abs(verticalGap) * 0.45, 28);
  const controlY1 = sourceY + controlOffset;
  const controlY2 = targetY - controlOffset;
  return `M ${sourceX},${sourceY} C ${sourceX},${controlY1} ${targetX},${controlY2} ${targetX},${targetY}`;
}

export function OrganicTreeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) {
  const edgeKind = ((data as TreeEdgeData | undefined)?.kind ?? 'branch') as string;
  const path = buildOrganicPath(sourceX, sourceY, targetX, targetY);

  return (
    <>
      <BaseEdge id={`${id}-shadow`} path={path} className={`tree-edge tree-edge-shadow tree-edge--${edgeKind}`} />
      <BaseEdge id={id} path={path} className={`tree-edge tree-edge-main tree-edge--${edgeKind}`} />
    </>
  );
}

