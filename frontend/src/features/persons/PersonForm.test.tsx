import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hasYandexMapsApiKey } from '@/shared/maps/yandexMapsSetup';
import { PersonForm } from './PersonForm';

const { createPlaceMock } = vi.hoisted(() => ({ createPlaceMock: vi.fn() }));

vi.mock('./hooks', () => ({
  usePerson: vi.fn(() => ({ data: undefined })),
  usePersons: vi.fn(() => ({ data: [] })),
  useAllBurialPlaces: vi.fn(() => ({ data: [] })),
  useBurialPlace: vi.fn(() => ({ data: undefined })),
  useCreateBurialPlace: vi.fn(() => ({
    mutateAsync: createPlaceMock,
    isPending: false,
    isError: false,
  })),
}));

vi.mock('@/shared/maps/yandexMapsSetup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/maps/yandexMapsSetup')>();
  return { ...actual, hasYandexMapsApiKey: vi.fn(() => false) };
});

beforeEach(() => {
  createPlaceMock.mockReset();
  vi.mocked(hasYandexMapsApiKey).mockReturnValue(false);
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
    expect(screen.getByRole('heading', { name: 'Место захоронения' })).toBeInTheDocument();
    expect(screen.getByLabelText('Детали участка')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Поиск кладбища/i)).not.toBeInTheDocument();
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
    await user.click(screen.getAllByRole('button', { name: 'Сохранить' })[0]);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    const [values, files] = handleSubmit.mock.calls[0];
    expect(values.last_name).toBe('Иванов');
    expect(values.first_name).toBe('Пётр');
    expect(files).toEqual({ photo: null, gravePhoto: null });
  });

  it('renders photo input as a plain optional file input', async () => {
    const user = userEvent.setup();
    render(<PersonForm onSubmit={vi.fn()} />);

    await goToStep(user, 'Фото');
    const photoLabel = screen.getByText('Портрет', { exact: false });
    const photoInput = photoLabel.closest('div')!.querySelector('input[type="file"]') as HTMLInputElement;
    expect(photoInput).toBeTruthy();
    expect(photoInput.required).toBe(false);
  });
});

describe('PersonForm - burial place create without a maps key', () => {
  it('keeps manual lat/lng fields and does not auto-fill the cemetery name', async () => {
    const user = userEvent.setup();
    render(<PersonForm onSubmit={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Статус'), 'deceased');
    await goToStep(user, 'Захоронение');

    expect(
      screen.getByText(/Карта недоступна \(не задан ключ Яндекс\.Карт\)/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toHaveValue('');
    expect(screen.getByLabelText('Широта')).toBeInTheDocument();
    expect(screen.getByLabelText('Долгота')).toBeInTheDocument();
    expect(screen.queryByText(/Кликните на карте/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Поиск кладбища/i)).not.toBeInTheDocument();
  });
});

describe('PersonForm - burial place map is the primary input', () => {
  it('puts the map button first and folds manual fields behind a disclosure', async () => {
    vi.mocked(hasYandexMapsApiKey).mockReturnValue(true);
    const user = userEvent.setup();
    render(<PersonForm onSubmit={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Статус'), 'deceased');
    await goToStep(user, 'Захоронение');

    const mapButton = screen.getByRole('button', { name: 'Указать на карте' });
    const manualToggle = screen.getByText('Указать вручную');
    expect(mapButton.compareDocumentPosition(manualToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Поиск кладбища/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Карта недоступна/i)).not.toBeInTheDocument();
  });
});

describe('PersonForm - a new burial place is saved together with the person', () => {
  async function fillNewPlace(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Фамилия *'), 'Романова');
    await user.type(screen.getByLabelText('Имя *'), 'Вадим');
    await user.selectOptions(screen.getByLabelText('Статус'), 'deceased');
    await goToStep(user, 'Захоронение');
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
    await user.click(screen.getAllByRole('button', { name: 'Сохранить' })[0]);

    await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(1));
    expect(createPlaceMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Новое кладбище', latitude: 55.5, longitude: 37.5 }),
    );
    expect(handleSubmit.mock.calls[0][0].burial_place).toBe(77);
  });

  it('auto-generates place name from coordinates when name is empty', async () => {
    createPlaceMock.mockResolvedValue({ id: 88 });
    const handleSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PersonForm onSubmit={handleSubmit} />);

    await fillNewPlace(user);
    await user.type(screen.getByLabelText('Широта'), '55.5');
    await user.type(screen.getByLabelText('Долгота'), '37.5');
    await user.click(screen.getAllByRole('button', { name: 'Сохранить' })[0]);

    await waitFor(() => expect(createPlaceMock).toHaveBeenCalled());
    expect(createPlaceMock.mock.calls[0][0].name).toBe('55.5, 37.5');
    expect(handleSubmit).toHaveBeenCalled();
  });

  it('leaves the person unsaved when the place cannot be created', async () => {
    createPlaceMock.mockRejectedValue(new Error('400'));
    const handleSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PersonForm onSubmit={handleSubmit} />);

    await fillNewPlace(user);
    await user.type(screen.getByLabelText('Название'), 'Новое кладбище');
    await user.click(screen.getAllByRole('button', { name: 'Сохранить' })[0]);

    expect(await screen.findByText(/Не удалось сохранить место захоронения/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
