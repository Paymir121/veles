import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FamilyNodeData, PersonNodeData } from './elkLayoutAdapter';

type PersonNodeProps = NodeProps & { data: PersonNodeData };
type FamilyNodeProps = NodeProps & { data: FamilyNodeData };

export function PersonNode({ data }: PersonNodeProps) {
  const circleClass =
    data.status === 'alive'
      ? 'person-node-circle--alive'
      : data.isRootGeneration
        ? 'person-node-circle--root'
        : 'person-node-circle--deceased';

  return (
    <div className="person-node">
      <Handle type="target" position={Position.Bottom} className="!invisible" />
      <div className="person-node-hitbox">
        <div className={`person-node-circle ${circleClass}`} aria-hidden="true" />
        <div className="person-node-label">{data.label}</div>
      </div>
      <Handle type="source" position={Position.Top} className="!invisible" />
    </div>
  );
}

export function FamilyNode(_props: FamilyNodeProps) {
  return (
    <div className="family-node" aria-hidden="true">
      <Handle type="target" position={Position.Bottom} className="!invisible" />
      <Handle type="source" position={Position.Top} className="!invisible" />
    </div>
  );
}
