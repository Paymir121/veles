import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import { PersonNode } from './PersonNode';
import type { PersonNodeData } from './elkLayoutAdapter';

function renderPersonNode(data: Partial<PersonNodeData>) {
  const nodeData: PersonNodeData = {
    kind: 'person',
    label: 'Петров Иван Сергеевич',
    lifespan: '1950 – 2020',
    status: 'alive',
    isRootGeneration: false,
    hasChildren: false,
    avatar: 'http://example.com/photo.jpg',
    showPhotos: true,
    ...data,
  };

  render(
    <MemoryRouter>
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
      </ReactFlowProvider>
    </MemoryRouter>,
  );
}

describe('PersonNode', () => {
  it('renders a card with FIO, years, and an edit button', () => {
    renderPersonNode({});
    expect(screen.getByText('Петров Иван Сергеевич')).toBeInTheDocument();
    expect(screen.getByText('1950 – 2020')).toBeInTheDocument();
    const edit = screen.getByRole('button', { name: 'Редактировать' });
    expect(edit).toBeInTheDocument();
    expect(edit).not.toHaveTextContent('Изменить');
    expect(document.querySelector('.person-node-card--alive')).not.toBeNull();
  });

  it('omits the years line when lifespan is empty', () => {
    renderPersonNode({ lifespan: '' });
    expect(document.querySelector('.person-node-years')).toBeNull();
  });

  it('does not render photo when showPhotos is off', () => {
    renderPersonNode({ showPhotos: false, avatar: 'http://example.com/photo.jpg' });
    expect(document.querySelector('.person-node-photo')).toBeNull();
    expect(document.querySelector('.person-node-photo-wrap')).toBeNull();
  });

  it('renders photo inside the card when showPhotos is on and avatar exists', () => {
    renderPersonNode({ showPhotos: true, avatar: 'http://example.com/media/photos/photo.jpg' });
    const photo = document.querySelector('.person-node-photo') as HTMLElement;
    expect(photo).not.toBeNull();
    expect(photo.style.backgroundImage).toContain('/media/photos/photo.jpg');
    expect(photo.closest('.person-node-photo-wrap--filled')).not.toBeNull();
  });

  it('renders a placeholder when avatar is missing even in photo mode', () => {
    renderPersonNode({ showPhotos: true, avatar: null });
    expect(document.querySelector('.person-node-photo')).toBeNull();
    expect(document.querySelector('.person-node-photo-placeholder')).not.toBeNull();
  });

  it('uses a brown border for a deceased person', () => {
    renderPersonNode({ status: 'deceased', isRootGeneration: false });
    expect(document.querySelector('.person-node-card--deceased')).not.toBeNull();
  });
});
