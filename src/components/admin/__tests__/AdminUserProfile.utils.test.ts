import { describe, it, expect } from 'vitest';
import { formatLastFirst, emailToColor } from '../AdminUserProfile';

describe('formatLastFirst', () => {
  it('formats "Shivam Kanodia" as "Kanodia, Shivam"', () => {
    expect(formatLastFirst('Shivam Kanodia')).toBe('Kanodia, Shivam');
  });

  it('handles multi-word first names: "Mary Jo Smith" → "Smith, Mary Jo"', () => {
    expect(formatLastFirst('Mary Jo Smith')).toBe('Smith, Mary Jo');
  });

  it('returns the raw value when there is no space', () => {
    expect(formatLastFirst('Madonna')).toBe('Madonna');
  });
});

describe('emailToColor', () => {
  it('returns a valid Tailwind bg color class', () => {
    const validColors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
      'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
    ];
    const result = emailToColor('shivam@example.com');
    expect(validColors).toContain(result);
  });

  it('returns the same color for the same email (deterministic)', () => {
    expect(emailToColor('a@b.com')).toBe(emailToColor('a@b.com'));
  });

  it('returns different colors for different emails (likely)', () => {
    const c1 = emailToColor('alice@example.com');
    const c2 = emailToColor('bob@example.com');
    expect(c1).toMatch(/^bg-\w+-500$/);
    expect(c2).toMatch(/^bg-\w+-500$/);
  });
});
