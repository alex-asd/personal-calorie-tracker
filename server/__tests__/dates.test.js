import { describe, it, expect } from 'vitest';
import { today, parseDate, daysBetween, addDays } from '../dates.js';

describe('today()', () => {
  it('returns a YYYY-MM-DD string with zero-padded month and day', () => {
    const t = today();
    expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('parseDate()', () => {
  it('parses a YYYY-MM-DD string into a local-time Date', () => {
    const d = parseDate('2025-03-05');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(5);
  });
});

describe('daysBetween()', () => {
  it('returns 0 for the same date', () => {
    expect(daysBetween('2025-03-05', '2025-03-05')).toBe(0);
  });

  it('returns the number of days between two dates', () => {
    expect(daysBetween('2025-03-05', '2025-03-10')).toBe(5);
  });

  it('handles month boundaries', () => {
    expect(daysBetween('2025-01-30', '2025-02-02')).toBe(3);
  });

  it('handles year boundaries', () => {
    expect(daysBetween('2024-12-30', '2025-01-02')).toBe(3);
  });

  it('returns negative for reversed order', () => {
    expect(daysBetween('2025-03-10', '2025-03-05')).toBe(-5);
  });
});

describe('addDays()', () => {
  it('adds days within a month', () => {
    expect(addDays('2025-03-05', 3)).toBe('2025-03-08');
  });

  it('adds days across a month boundary', () => {
    expect(addDays('2025-01-30', 5)).toBe('2025-02-04');
  });

  it('subtracts days', () => {
    expect(addDays('2025-03-05', -10)).toBe('2025-02-23');
  });

  it('handles year boundaries', () => {
    expect(addDays('2024-12-30', 5)).toBe('2025-01-04');
  });

  it('round-trips with daysBetween', () => {
    const start = '2025-06-15';
    const end = addDays(start, 42);
    expect(daysBetween(start, end)).toBe(42);
  });
});
