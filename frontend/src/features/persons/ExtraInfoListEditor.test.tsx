import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExtraInfoListEditor } from './ExtraInfoListEditor';
import type { ExtraInfoItem } from '@/shared/types';

// ExtraInfoListEditor is a fully controlled component (items + onChange),
// exactly like it's used inside the real PersonForm. A harness that owns
// state and actually re-renders on every onChange is required for realistic
// typing simulation - a bare "record the calls, never re-render" mock would
// snap each keystroke's controlled input back to the stale prop value
// before the next keystroke lands.
function Harness({
  initialItems,
  onChangeSpy,
}: {
  initialItems: ExtraInfoItem[];
  onChangeSpy: (items: ExtraInfoItem[]) => void;
}) {
  const [items, setItems] = useState(initialItems);
  function handleChange(next: ExtraInfoItem[]) {
    setItems(next);
    onChangeSpy(next);
  }
  return <ExtraInfoListEditor items={items} onChange={handleChange} />;
}

function renderEditor(initialItems: ExtraInfoItem[] = []) {
  const onChange = vi.fn();
  const utils = render(<Harness initialItems={initialItems} onChangeSpy={onChange} />);
  return { onChange, ...utils };
}

describe('ExtraInfoListEditor', () => {
  it('renders no rows and a hint when empty', () => {
    renderEditor([]);
    expect(screen.getByText('Записей пока нет.')).toBeInTheDocument();
    expect(screen.queryAllByTestId('extra-info-row')).toHaveLength(0);
  });

  it('adds a new empty row when "Добавить запись" is clicked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor([]);

    await user.click(screen.getByRole('button', { name: 'Добавить запись' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      { category: '', title: '', role: '', date_from: '', date_to: '', description: '' },
    ]);
  });

  it('removes a row when its "Удалить" button is clicked', async () => {
    const user = userEvent.setup();
    const items: ExtraInfoItem[] = [
      {
        category: 'образование',
        title: 'Школа №1',
        role: '',
        date_from: '',
        date_to: '',
        description: '',
      },
      { category: 'служба', title: 'Армия', role: '', date_from: '', date_to: '', description: '' },
    ];
    const { onChange } = renderEditor(items);

    await user.click(screen.getByRole('button', { name: 'Удалить запись 1' }));

    expect(onChange).toHaveBeenCalledWith([items[1]]);
  });

  it('allows an arbitrary free-text category (not a fixed enum)', async () => {
    const user = userEvent.setup();
    const items: ExtraInfoItem[] = [
      { category: '', title: '', role: '', date_from: '', date_to: '', description: '' },
    ];
    const { onChange } = renderEditor(items);

    const categoryInput = screen.getByLabelText('Категория, запись 1');
    await user.type(categoryInput, 'необычная категория');

    const lastCall = onChange.mock.calls.at(-1)?.[0] as ExtraInfoItem[];
    expect(lastCall[0].category).toBe('необычная категория');
  });

  it('enforces the client-side length caps that mirror the backend validator', () => {
    renderEditor([
      { category: '', title: '', role: '', date_from: '', date_to: '', description: '' },
    ]);

    expect(screen.getByLabelText('Категория, запись 1')).toHaveAttribute('maxLength', '300');
    expect(screen.getByLabelText('Описание, запись 1')).toHaveAttribute('maxLength', '2000');
  });
});
