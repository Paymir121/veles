import { describe, expect, it } from 'vitest';
import { resolveMediaUrl } from './resolveMediaUrl';

describe('resolveMediaUrl', () => {
  it('returns null for empty input', () => {
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl(undefined)).toBeNull();
    expect(resolveMediaUrl('')).toBeNull();
  });

  it('keeps relative paths unchanged', () => {
    expect(resolveMediaUrl('/media/photos/test.jpg')).toBe('/media/photos/test.jpg');
  });

  it('strips localhost host from absolute media URLs', () => {
    expect(resolveMediaUrl('http://localhost:8000/media/photos/test.jpg')).toBe('/media/photos/test.jpg');
  });

  it('strips production host when path is under /media/', () => {
    expect(resolveMediaUrl('https://veles.example.com/media/photos/test.jpg')).toBe('/media/photos/test.jpg');
  });
});
