import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { NavBar } from './NavBar';
import { useTreeUiStore } from '@/features/tree/treeUiStore';

afterEach(() => {
  useTreeUiStore.setState({ showPhotos: true, isPeoplePanelOpen: false });
});

function renderNav(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavBar />
    </MemoryRouter>,
  );
}

describe('NavBar mobile tree extras', () => {
  it('puts People and photo toggles into the menu on the tree page', async () => {
    const user = userEvent.setup();
    renderNav('/tree');

    expect(screen.queryByRole('button', { name: 'Люди' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));
    expect(screen.getByRole('button', { name: 'Люди' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скрыть фото' })).toBeInTheDocument();
  });

  it('does not show tree extras outside the tree page', async () => {
    const user = userEvent.setup();
    renderNav('/');

    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));
    expect(screen.queryByRole('button', { name: 'Люди' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Скрыть фото' })).not.toBeInTheDocument();
  });

  it('toggles the people panel from the mobile menu', async () => {
    const user = userEvent.setup();
    renderNav('/tree');

    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));
    await user.click(screen.getByRole('button', { name: 'Люди' }));
    expect(useTreeUiStore.getState().isPeoplePanelOpen).toBe(true);
  });
});
