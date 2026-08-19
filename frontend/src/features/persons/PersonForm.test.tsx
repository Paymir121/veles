import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PersonForm } from './PersonForm';

// PersonForm pulls in TanStack Query hooks (father/mother picker, burial
// place search + inline create) that would otherwise hit the real axios
// client. Mocking './hooks' keeps this a pure component test with no
// network/QueryClientProvider setup required.
vi.mock('./hooks', () => ({
  usePerson: vi.fn(() => ({ data: undefined })),
  usePersons: vi.fn(() => ({ data: [] })),
  useBurialPlaceSearch: vi.fn(() => ({ data: [] })),
  useBurialPlaceOption: vi.fn(() => ({ data: undefined })),
  useCreateBurialPlace: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false })),
}));

vi.mock('@/shared/maps/yandexMapsSetup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/maps/yandexMapsSetup')>();
  return { ...actual, hasYandexMapsApiKey: () => false };
});

describe('PersonForm - status-driven conditional fields', () => {
  it('hides death/burial fields for the default "alive" status', () => {
    render(<PersonForm onSubmit={vi.fn()} />);

    expect(screen.queryByLabelText('Дата смерти')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Место захоронения' })).not.toBeInTheDocument();
  });

  it('shows death/burial fields once status is switched to "deceased"', async () => {
    const user = userEvent.setup();
    render(<PersonForm onSubmit={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Статус'), 'deceased');

    expect(screen.getByLabelText('Дата смерти')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Место захоронения' })).toBeInTheDocument();
  });

  it('clears (not just hides) burial fields when switching back to alive', async () => {
    const user = userEvent.setup();
    render(<PersonForm onSubmit={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Статус'), 'deceased');
    await user.type(screen.getByLabelText('Детали участка'), 'участок 5, ряд 3');
    expect(screen.getByLabelText('Детали участка')).toHaveValue('участок 5, ряд 3');

    await user.selectOptions(screen.getByLabelText('Статус'), 'alive');
    expect(screen.queryByLabelText('Детали участка')).not.toBeInTheDocument();

    // Switching back to deceased should show an EMPTY field, proving the
    // underlying value was actually cleared in state, not merely hidden -
    // this matters because the API layer relies on the cleared value being
    // sent explicitly to wipe stale burial data server-side on an edit.
    await user.selectOptions(screen.getByLabelText('Статус'), 'deceased');
    expect(screen.getByLabelText('Детали участка')).toHaveValue('');
  });
});

describe('PersonForm - optional photo submission', () => {
  it('submits successfully with neither photo field set', async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PersonForm onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText('Фамилия'), 'Иванов');
    await user.type(screen.getByLabelText('Имя'), 'Пётр');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    const [values, files] = handleSubmit.mock.calls[0];
    expect(values.last_name).toBe('Иванов');
    expect(values.first_name).toBe('Пётр');
    expect(files).toEqual({ photo: null, gravePhoto: null });
  });

  it('renders both photo inputs as plain optional file inputs', () => {
    render(<PersonForm onSubmit={vi.fn()} />);
    const photoInput = screen.getByLabelText('Портрет (необязательно)') as HTMLInputElement;
    expect(photoInput.type).toBe('file');
    expect(photoInput.required).toBe(false);
  });
});

describe('PersonForm - burial place create without a maps key', () => {
  it('keeps manual lat/lng fields and does not auto-fill the cemetery name', async () => {
    const user = userEvent.setup();
    render(<PersonForm onSubmit={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Статус'), 'deceased');
    await user.click(screen.getByRole('button', { name: 'Добавить новое место' }));

    expect(
      screen.getByText(/Карта недоступна \(не задан ключ Яндекс\.Карт\)/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toHaveValue('');
    expect(screen.getByLabelText('Широта')).toBeInTheDocument();
    expect(screen.getByLabelText('Долгота')).toBeInTheDocument();
    expect(screen.queryByText(/Кликните на карте/i)).not.toBeInTheDocument();
  });
});
