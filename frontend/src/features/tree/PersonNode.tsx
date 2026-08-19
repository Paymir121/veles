import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FamilyNodeData, PersonNodeData } from './elkLayoutAdapter';

type PersonNodeProps = NodeProps & { data: PersonNodeData };
type FamilyNodeProps = NodeProps & { data: FamilyNodeData };

export function PersonNode({ data }: PersonNodeProps) {
  const isAlive = data.status === 'alive';

  return (
    <div className="person-node">
      <Handle type="target" position={Position.Bottom} className="!invisible" />
      <div
        className="person-node-circle"
        style={{ background: isAlive ? 'var(--color-accent-secondary)' : '#334155' }}
      />
      <div className="person-node-label">{data.label}</div>
      <Handle type="source" position={Position.Top} className="!invisible" />
    </div>
  );
}

export function FamilyNode(_props: FamilyNodeProps) {
  return (
    <div className="family-node" aria-hidden="true">
      <Handle type="target" position={Position.Bottom} className="!invisible" />
      <div className="family-node-bar" />
      <Handle type="source" position={Position.Top} className="!invisible" />
    </div>
  );
}
