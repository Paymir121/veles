import { describe, expect, it } from 'vitest';
import { formatDisplayDate, parseDateInput } from './formatDate';

describe('formatDisplayDate', () => {
  it('formats ISO as day.month.year', () => {
    expect(formatDisplayDate('1921-03-04')).toBe('04.03.1921');
  });

  it('returns empty for nullish values', () => {
    expect(formatDisplayDate(null)).toBe('');
    expect(formatDisplayDate(undefined)).toBe('');
    expect(formatDisplayDate('')).toBe('');
  });
});

describe('parseDateInput', () => {
  it('parses dotted and slashed Russian dates', () => {
    expect(parseDateInput('4.3.1921')).toBe('1921-03-04');
    expect(parseDateInput('04/03/1921')).toBe('1921-03-04');
  });

  it('keeps a valid ISO date', () => {
    expect(parseDateInput('1921-03-04')).toBe('1921-03-04');
  });

  it('clears empty input and rejects incomplete typing', () => {
    expect(parseDateInput('  ')).toBe('');
    expect(parseDateInput('04.03')).toBeNull();
    expect(parseDateInput('31.02.1921')).toBeNull();
  });
});
