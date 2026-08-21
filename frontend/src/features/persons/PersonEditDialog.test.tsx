import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonEditDialog } from './PersonEditDialog';

const { usePersonMock, updateMutateMock } = vi.hoisted(() => ({
  usePersonMock: vi.fn(),
  updateMutateMock: vi.fn(),
}));

vi.mock('./hooks', () => ({
  usePerson: (...args: unknown[]) => usePersonMock(...args),
  usePersons: vi.fn(() => ({ data: [] })),
  useAllBurialPlaces: vi.fn(() => ({ data: [] })),
  useBurialPlace: vi.fn(() => ({ data: undefined })),
  useCreateBurialPlace: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
  })),
  useCreatePerson: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdatePerson: vi.fn(() => ({
    mutate: updateMutateMock,
    isPending: false,
    isError: false,
  })),
}));

vi.mock('@/shared/maps/yandexMapsSetup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/maps/yandexMapsSetup')>();
  return { ...actual, hasYandexMapsApiKey: vi.fn(() => false) };
});

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});

beforeEach(() => {
  usePersonMock.mockReturnValue({
    data: {
      id: 12,
      first_name: 'Иван',
      last_name: 'Петров',
      patronymic: '',
      maiden_name: '',
      gender: 'M',
      birth_date: '1950-01-02',
      birth_date_text: '',
      birth_place: '',
      status: 'alive',
      death_date: null,
      death_date_text: '',
      father: null,
      mother: null,
      children: [],
      spouses: [],
      siblings: [],
      burial_place: null,
      burial_plot_details: '',
      photo: null,
      grave_photo: null,
      extra_info: [],
      notes: '',
    },
    isLoading: false,
    isError: false,
  });
  updateMutateMock.mockReset();
});

describe('PersonEditDialog', () => {
  it('opens the form on the same page and can be closed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PersonEditDialog personId={12} onClose={onClose} />);

    expect(screen.getByRole('heading', { name: 'Редактирование: Петров Иван' })).toBeInTheDocument();
    expect(screen.getByLabelText('Фамилия *')).toHaveValue('Петров');
    expect(screen.getByPlaceholderText('ДД.ММ.ГГГГ')).toHaveValue('02.01.1950');

    await user.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
