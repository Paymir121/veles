import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('shows a short description and a how-to, without the old marketing copy', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Велес' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'О проекте' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Как пользоваться' })).toBeInTheDocument();
    expect(screen.getByText(/интерактивное дерево и карта захоронений/i)).toBeInTheDocument();

    expect(screen.queryByText('Что это такое')).not.toBeInTheDocument();
    expect(screen.queryByText('Зачем это нужно')).not.toBeInTheDocument();
    expect(screen.queryByText('Возможности')).not.toBeInTheDocument();
  });
});
