import { type MouseEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { resolveMediaUrl } from '@/shared/utils/resolveMediaUrl';
import type { FamilyNodeData, PersonNodeData } from './elkLayoutAdapter';

type PersonNodeProps = NodeProps & { data: PersonNodeData };
type FamilyNodeProps = NodeProps & { data: FamilyNodeData };

function cardStatusClass(data: PersonNodeData): string {
  if (data.status === 'alive') return 'person-node-card--alive';
  if (data.isRootGeneration) return 'person-node-card--root';
  return 'person-node-card--deceased';
}

function cardGenderClass(data: PersonNodeData): string {
  if (data.gender === 'F') return 'person-node-card--female';
  if (data.gender === 'M') return 'person-node-card--male';
  return '';
}

function nameInitial(label: string): string {
  const letter = label.trim().charAt(0);
  return letter ? letter.toUpperCase() : '?';
}

export function PersonNode({ id, data }: PersonNodeProps) {
  if (!data || data.kind !== 'person') return null;

  const showPhoto = Boolean(data.showPhotos);
  const photoSrc = showPhoto ? resolveMediaUrl(data.avatar) : null;

  function handleEdit(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    data.onEdit?.(id);
  }

  return (
    <div className="person-node" aria-label={data.label}>
      <Handle id="bottom-left" type="target" position={Position.Bottom} className="!invisible !left-[28%]" />
      <Handle id="bottom-center" type="target" position={Position.Bottom} className="!invisible !left-1/2" />
      <Handle id="bottom-right" type="target" position={Position.Bottom} className="!invisible !left-[72%]" />
      <div
        className={`person-node-card ${cardStatusClass(data)} ${cardGenderClass(data)}${showPhoto ? ' person-node-card--photo-mode' : ''}${data.selected ? ' person-node-card--selected' : ''}`}
      >
        {showPhoto && (
          <div className={`person-node-photo-wrap${photoSrc ? ' person-node-photo-wrap--filled' : ''}`}>
            {photoSrc ? (
              <div
                className="person-node-photo"
                role="img"
                aria-hidden="true"
                style={{ backgroundImage: `url("${photoSrc}")` }}
              />
            ) : (
              <div className="person-node-photo-placeholder" aria-hidden="true">
                {nameInitial(data.label)}
              </div>
            )}
          </div>
        )}
        <div className="person-node-body">
          <div className="person-node-name" title={data.label}>{data.label}</div>
          {data.lifespan ? <div className="person-node-years">{data.lifespan}</div> : null}
        </div>
        {data.showEdit && (
        <button
          type="button"
          className="person-node-edit nodrag nopan"
          aria-label="Редактировать"
          title="Редактировать"
          onClick={handleEdit}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        )}
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
      <Handle id="top-right" type="source" position={Position.Top} className="!invisible !left-[70%]" />
    </div>
  );
}
