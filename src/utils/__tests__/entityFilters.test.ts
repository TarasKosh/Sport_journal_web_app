import { describe, it, expect } from 'vitest';
import { isActive, onlyActive } from '../entityFilters';

describe('entityFilters', () => {
  it('isActive treats missing deletedAt as active', () => {
    expect(isActive({})).toBe(true);
    expect(isActive({ deletedAt: undefined })).toBe(true);
    expect(isActive({ deletedAt: null })).toBe(true);
  });

  it('isActive treats numeric deletedAt as deleted', () => {
    expect(isActive({ deletedAt: Date.now() })).toBe(false);
  });

  it('onlyActive filters deleted rows', () => {
    const rows: Array<{ id: string; deletedAt?: number | null }> = [
      { id: '1' },
      { id: '2', deletedAt: 1 },
      { id: '3', deletedAt: undefined },
    ];
    expect(onlyActive(rows).map((r) => r.id)).toEqual(['1', '3']);
  });
});
