import { render } from '@testing-library/react';
import { Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { OrganicTreeEdge } from './OrganicTreeEdge';

function renderEdge(kind: 'root' | 'branch' | 'leafStem') {
  return render(
    <svg>
      <OrganicTreeEdge
        id="e1"
        source="a"
        target="b"
        sourceX={10}
        sourceY={80}
        targetX={40}
        targetY={10}
        sourcePosition={Position.Top}
        targetPosition={Position.Bottom}
        data={{ kind }}
        style={{ strokeWidth: 4 }}
      />
    </svg>,
  );
}

describe('OrganicTreeEdge', () => {
  it('uses a rounded elbow instead of a sweeping cubic', () => {
    const { container } = renderEdge('branch');
    const path = container.querySelector('.tree-edge-main') as SVGPathElement | null;
    const d = path?.getAttribute('d') ?? '';
    expect(path).not.toBeNull();
    expect(d.startsWith('M10 80') || d.startsWith('M 10,80')).toBe(true);
    expect(d.includes('40,10') || d.includes('40 10')).toBe(true);
    expect(d).not.toMatch(/ C /);
  });

  it('marks trunk, wood, and living shoots for CSS', () => {
    const { container, unmount } = renderEdge('root');
    expect(container.querySelector('.tree-edge-main.tree-edge--root')).not.toBeNull();
    expect(container.querySelector('.tree-edge-shadow.tree-edge--root')).not.toBeNull();
    unmount();

    const living = renderEdge('leafStem');
    expect(living.container.querySelector('.tree-edge-main.tree-edge--leafStem')).not.toBeNull();
  });
});
