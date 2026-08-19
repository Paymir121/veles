import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PersonForm } from './PersonForm';

const { createPlaceMock } = vi.hoisted(() => ({ createPlaceMock: vi.fn() }));

vi.mock('./hooks', () => ({
  usePerson: vi.fn(() => ({ data: undefined })),
  usePersons: vi.fn(() => ({ data: [] })),
  useBurialPlaceSearch: vi.fn(() => ({ data: [] })),
  useBurialPlaceOption: vi.fn(() => ({ data: undefined })),
  useCreateBurialPlace: vi.fn(() => ({
    mutateAsync: createPlaceMock,
    isPending: false,
    isError: false,
  })),
}));

beforeEach(() => {
  createPlaceMock.mockReset();
});

vi.mock('@/shared/maps/yandexMapsSetup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/maps/yandexMapsSetup')>();
  return { ...actual, hasYandexMapsApiKey: () => false };
});

async function goToStep(user: ReturnType<typeof userEvent.setup>, stepName: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(stepName) }));
}

describe('PersonForm - status-driven conditional fields', () => {
  it('hides death/burial fields for the default "alive" status', () => {
    render(<PersonForm onSubmit={vi.fn()} />);

    expect(screen.queryByLabelText('Дата смерти')).not.toBeInTheDocument();
    // Burial step should not appear in wizard indicator
    expect(screen.queryByRole('button', { name: /Захоронение/ })).not.toBeInTheDocument();
  });

  it('shows death/burial fields once status is switched to "deceased"', async () => {
    const user = userEvent.setup();
    render(<PersonForm onSubmit={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Статус'), 'deceased');

    // Death date appears on basics step
    expect(screen.getByLabelText('Дата смерти')).toBeInTheDocument();
    // Burial step appears in wizard indicator
    expect(screen.getByRole('button', { name: /Захоронение/ })).toBeInTheDocument();

    // Navigate to burial step
    await goToStep(user, 'Захоронение');
    expect(screen.getByLabelText('Место захоронения')).toBeInTheDocument();
  });

  it('clears (not just hides) burial fields when switching back to alive', async () => {
    const user = userEvent.setup();
    render(<PersonForm onSubmit={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Статус'), 'deceased');
    await goToStep(user, 'Захоронение');
    await user.type(screen.getByLabelText('Детали участка'), 'участок 5, ряд 3');
    expect(screen.getByLabelText('Детали участка')).toHaveValue('участок 5, ряд 3');

    // Switch back to basics and change status to alive
    await goToStep(user, 'Основное');
    await user.selectOptions(screen.getByLabelText('Статус'), 'alive');
    // Burial step disappears
    expect(screen.queryByRole('button', { name: /Захоронение/ })).not.toBeInTheDocument();

    // Switch to deceased again and check the field is empty
    await user.selectOptions(screen.getByLabelText('Статус'), 'deceased');
    await goToStep(user, 'Захоронение');
    expect(screen.getByLabelText('Детали участка')).toHaveValue('');
  });
});

describe('PersonForm - optional photo submission', () => {
  it('submits successfully with neither photo field set', async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PersonForm onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText('Фамилия *'), 'Иванов');
    await user.type(screen.getByLabelText('Имя *'), 'Пётр');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    const [values, files] = handleSubmit.mock.calls[0];
    expect(values.last_name).toBe('Иванов');
    expect(values.first_name).toBe('Пётр');
    expect(files).toEqual({ photo: null, gravePhoto: null });
  });

  it('renders both photo inputs as plain optional file inputs', async () => {
    const user = userEvent.setup();
    render(<PersonForm onSubmit={vi.fn()} />);

    // Navigate to extras step where photos live
    await goToStep(user, 'Фото');
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
    await goToStep(user, 'Захоронение');
    await user.click(screen.getByRole('button', { name: /Добавить новое место/ }));

    expect(
      screen.getByText(/Карта недоступна \(не задан ключ Яндекс\.Карт\)/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toHaveValue('');
    expect(screen.getByLabelText('Широта')).toBeInTheDocument();
    expect(screen.getByLabelText('Долгота')).toBeInTheDocument();
    expect(screen.queryByText(/Кликните на карте/i)).not.toBeInTheDocument();
  });
});

describe('PersonForm - a new burial place is saved together with the person', () => {
  async function fillNewPlace(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Фамилия *'), 'Романова');
    await user.type(screen.getByLabelText('Имя *'), 'Вадим');
    await user.selectOptions(screen.getByLabelText('Статус'), 'deceased');
    await goToStep(user, 'Захоронение');
    await user.click(screen.getByRole('button', { name: /Добавить новое место/ }));
  }

  // The bug this covers: a place typed in (or a point picked on the map) used to
  // be discarded unless a separate "create place" button was pressed, so the
  // person was saved with no grave and never showed up on the map.
  it('creates the place and submits the person with its id', async () => {
    createPlaceMock.mockResolvedValue({ id: 77 });
    const handleSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PersonForm onSubmit={handleSubmit} />);

    await fillNewPlace(user);
    await user.type(screen.getByLabelText('Название'), 'Новое кладбище');
    await user.type(screen.getByLabelText('Широта'), '55.5');
    await user.type(screen.getByLabelText('Долгота'), '37.5');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(1));
    expect(createPlaceMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Новое кладбище', latitude: 55.5, longitude: 37.5 }),
    );
    expect(handleSubmit.mock.calls[0][0].burial_place).toBe(77);
  });

  it('refuses to submit a place with no name instead of dropping it', async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PersonForm onSubmit={handleSubmit} />);

    await fillNewPlace(user);
    await user.type(screen.getByLabelText('Широта'), '55.5');
    await user.type(screen.getByLabelText('Долгота'), '37.5');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText(/Укажите название нового места/i)).toBeInTheDocument();
    expect(createPlaceMock).not.toHaveBeenCalled();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('leaves the person unsaved when the place cannot be created', async () => {
    createPlaceMock.mockRejectedValue(new Error('400'));
    const handleSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PersonForm onSubmit={handleSubmit} />);

    await fillNewPlace(user);
    await user.type(screen.getByLabelText('Название'), 'Новое кладбище');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText(/Не удалось сохранить место захоронения/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
