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

function CenterHandles() {
  return (
    <>
      <Handle id="in" type="target" position={Position.Bottom} className="tree-node-handle" isConnectable={false} />
      <Handle id="out" type="source" position={Position.Top} className="tree-node-handle" isConnectable={false} />
    </>
  );
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
      <CenterHandles />
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
    </div>
  );
}

export function FamilyNode({ data }: FamilyNodeProps) {
  if (!data || data.kind !== 'family') return null;

  return (
    <div className="family-node" aria-hidden="true">
      <div className="family-node-bar" />
      {Object.entries(data.parentHandlePct).map(([parentId, pct]) => (
        <Handle
          key={`in-${parentId}`}
          id={`in-${parentId}`}
          type="target"
          position={Position.Bottom}
          className="tree-node-handle"
          style={{ left: `${pct}%` }}
          isConnectable={false}
        />
      ))}
      {Object.entries(data.childHandlePct).map(([childId, pct]) => (
        <Handle
          key={`out-${childId}`}
          id={`out-${childId}`}
          type="source"
          position={Position.Top}
          className="tree-node-handle"
          style={{ left: `${pct}%` }}
          isConnectable={false}
        />
      ))}
    </div>
  );
}
