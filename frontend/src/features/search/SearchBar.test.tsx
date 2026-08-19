import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SearchResults } from '@/shared/types';
import { SearchBar } from './SearchBar';

const results: SearchResults = {
  persons: [
    {
      id: 1,
      first_name: 'Пётр',
      last_name: 'Соколов',
      patronymic: '',
      maiden_name: '',
      gender: 'M',
      status: 'deceased',
      birth_date: '1921-03-04',
      birth_date_text: '',
      birth_place: '',
      death_date: '1990-12-01',
      death_date_text: '',
      photo: null,
      burial_place_detail: null,
    },
    {
      id: 2,
      first_name: 'Анна',
      last_name: 'Соколова',
      patronymic: '',
      maiden_name: '',
      gender: 'F',
      status: 'alive',
      birth_date: null,
      birth_date_text: '',
      birth_place: '',
      death_date: null,
      death_date_text: '',
      photo: null,
      burial_place_detail: null,
    },
  ],
  burial_places: [
    {
      id: 10,
      name: 'Ваганьковское кладбище',
      city: 'Москва',
      latitude: 55.7761,
      longitude: 37.5589,
      address: '',
      description: '',
      persons: [],
    },
  ],
};

vi.mock('./hooks', () => ({
  useSearch: vi.fn((query: string) => ({
    data: query.trim() ? results : undefined,
    isFetching: false,
  })),
}));

async function typeQuery(user: ReturnType<typeof userEvent.setup>, query: string) {
  await user.type(screen.getByRole('combobox'), query);
  // The input is debounced (250ms) before the dropdown can open.
  await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
}

describe('SearchBar', () => {
  it('finds both people and burial places, with people first', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSelect={vi.fn()} />);

    await typeQuery(user, 'сокол');

    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Соколов Пётр1921 – 1990',
      'Соколова Анна',
      'Ваганьковское кладбищеМосква · нет записей',
    ]);
    expect(screen.getByText('Найдено: 3')).toBeInTheDocument();
    expect(screen.getByText('Люди')).toBeInTheDocument();
    expect(screen.getByText('Места захоронения')).toBeInTheDocument();
  });

  it('walks the list with the arrow keys and picks with Enter', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar onSelect={onSelect} />);

    await typeQuery(user, 'сокол');
    await user.keyboard('{ArrowDown}{ArrowDown}');

    const options = screen.getAllByRole('option');
    expect(options[2]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'burial_place',
      burialPlace: results.burial_places[0],
    });
  });

  it('keeps the typed query after a selection so a near-miss can be retried', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSelect={vi.fn()} />);

    await typeQuery(user, 'сокол');
    await user.keyboard('{Enter}');

    expect(screen.getByRole('combobox')).toHaveValue('сокол');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes on Escape without clearing the query', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSelect={vi.fn()} />);

    await typeQuery(user, 'сокол');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('сокол');
  });
});
