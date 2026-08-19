import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import { PersonNode } from './PersonNode';
import type { PersonNodeData } from './elkLayoutAdapter';

function renderPersonNode(data: Partial<PersonNodeData>) {
  const nodeData: PersonNodeData = {
    kind: 'person',
    label: 'Иван П.',
    status: 'alive',
    isRootGeneration: false,
    hasChildren: false,
    avatar: 'http://example.com/photo.jpg',
    showPhotos: false,
    ...data,
  };

  render(
    <ReactFlowProvider>
      <PersonNode
        id="1"
        type="person"
        data={nodeData}
        selected={false}
        zIndex={0}
        dragging={false}
        draggable={false}
        selectable={false}
        deletable={false}
        isConnectable={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    </ReactFlowProvider>,
  );
}

describe('PersonNode', () => {
  it('does not render photo when showPhotos is off', () => {
    renderPersonNode({ showPhotos: false, avatar: 'http://example.com/photo.jpg' });
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders photo inside the circle when showPhotos is on and avatar exists', () => {
    renderPersonNode({ showPhotos: true, avatar: 'http://example.com/photo.jpg' });
    const photo = screen.getByRole('presentation', { hidden: true });
    expect(photo).toHaveAttribute('src', 'http://example.com/photo.jpg');
    expect(photo).toHaveClass('person-node-photo');
    expect(photo.closest('.person-node-circle--with-photo')).not.toBeNull();
  });

  it('does not render photo when avatar is missing even in photo mode', () => {
    renderPersonNode({ showPhotos: true, avatar: null });
    expect(screen.queryByRole('img')).toBeNull();
  });
});
