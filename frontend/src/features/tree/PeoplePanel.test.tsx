import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TreePersonGroup } from './treePeople';
import { PeoplePanel } from './PeoplePanel';

function makeGroups(): TreePersonGroup[] {
  return [
    {
      id: 'g1',
      label: 'Семья А',
      people: [{ id: 'p1', name: 'Человек А', lifespan: '' }],
    },
    {
      id: 'g2',
      label: 'Семья B',
      people: [{ id: 'p2', name: 'Человек B', lifespan: '' }],
    },
  ];
}

describe('PeoplePanel collapses groups by default', () => {
  it('hides all groups except the one containing centeredId', async () => {
    const user = userEvent.setup();
    const groups = makeGroups();
    const onSelect = vi.fn();

    render(<PeoplePanel groups={groups} centeredId="p1" onSelect={onSelect} />);

    expect(screen.getByRole('button', { name: 'Человек А' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Человек B' })).not.toBeInTheDocument();

    // Clicking a person should still work (basic sanity for hidden lists).
    await user.click(screen.getByRole('button', { name: 'Человек А' }));
    expect(onSelect).toHaveBeenCalledWith('p1');
  });

  it('collapses all groups when centeredId is empty', () => {
    const groups = makeGroups();
    const onSelect = vi.fn();

    render(<PeoplePanel groups={groups} centeredId="" onSelect={onSelect} />);

    expect(screen.queryByRole('button', { name: 'Человек А' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Человек B' })).not.toBeInTheDocument();
  });
});

