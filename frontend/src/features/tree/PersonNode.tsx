import { Handle, Position, type NodeProps } from '@xyflow/react';
import { resolveMediaUrl } from '@/shared/utils/resolveMediaUrl';
import type { FamilyNodeData, PersonNodeData } from './elkLayoutAdapter';

type PersonNodeProps = NodeProps & { data: PersonNodeData };
type FamilyNodeProps = NodeProps & { data: FamilyNodeData };

export function PersonNode({ data }: PersonNodeProps) {
  if (!data || data.kind !== 'person') return null;

  const circleClass =
    data.status === 'alive'
      ? 'person-node-circle--alive'
      : data.isRootGeneration
        ? 'person-node-circle--root'
        : 'person-node-circle--deceased';

  const showPhoto = Boolean(data.showPhotos && data.avatar);
  const photoSrc = showPhoto ? resolveMediaUrl(data.avatar) : null;

  return (
    <div className="person-node">
      <Handle id="bottom-left" type="target" position={Position.Bottom} className="!invisible !left-[28%]" />
      <Handle id="bottom-center" type="target" position={Position.Bottom} className="!invisible !left-1/2" />
      <Handle id="bottom-right" type="target" position={Position.Bottom} className="!invisible !left-[72%]" />
      <div className="person-node-hitbox">
        <div
          className={`person-node-circle ${circleClass}${showPhoto ? ' person-node-circle--with-photo' : ''}${data.showPhotos ? ' person-node-circle--photo-mode' : ''}`}
          aria-hidden="true"
        >
          {photoSrc && <img src={photoSrc} alt="" className="person-node-photo" />}
        </div>
        <div className="person-node-label">{data.label}</div>
      </div>
      <Handle id="top-left" type="source" position={Position.Top} className="!invisible !left-[30%]" />
      <Handle id="top-center" type="source" position={Position.Top} className="!invisible !left-1/2" />
      <Handle id="top-right" type="source" position={Position.Top} className="!invisible !left-[70%]" />
    </div>
  );
}

export function FamilyNode(_props: FamilyNodeProps) {
  return (
    <div className="family-node" aria-hidden="true">
      <Handle id="bottom-left" type="target" position={Position.Bottom} className="!invisible !left-[28%]" />
      <Handle id="bottom-center" type="target" position={Position.Bottom} className="!invisible !left-1/2" />
      <Handle id="bottom-right" type="target" position={Position.Bottom} className="!invisible !left-[72%]" />
      <div className="family-node-bar" />
      <Handle id="top-left" type="source" position={Position.Top} className="!invisible !left-[28%]" />
      <Handle id="top-center" type="source" position={Position.Top} className="!invisible !left-1/2" />
      <Handle id="top-right" type="source" position={Position.Top} className="!invisible !left-[72%]" />
    </div>
  );
}
