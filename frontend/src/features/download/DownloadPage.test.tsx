import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DownloadPage } from './DownloadPage';
import { EXE_DOWNLOAD_URL, REPO_URL } from './links';

describe('DownloadPage', () => {
  it('links to the GitHub repository and the releases page for the exe', () => {
    render(<DownloadPage />);

    expect(screen.getByRole('link', { name: 'Открыть репозиторий' })).toHaveAttribute(
      'href',
      REPO_URL,
    );
    expect(screen.getByRole('link', { name: 'Скачать .exe' })).toHaveAttribute(
      'href',
      EXE_DOWNLOAD_URL,
    );
  });
});
