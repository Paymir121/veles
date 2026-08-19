import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PersonNodeData } from './elkLayoutAdapter';

type PersonNodeProps = NodeProps & { data: PersonNodeData };

export function PersonNode({ data }: PersonNodeProps) {
  const isAlive = data.status === 'alive';

  return (
    <div className="person-node">
      <Handle type="target" position={Position.Top} className="!invisible" />
      <div
        className="person-node-circle"
        style={{ background: isAlive ? 'var(--color-accent-secondary)' : '#334155' }}
      />
      <div className="person-node-label">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}
