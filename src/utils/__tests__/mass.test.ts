import { describe, it, expect } from 'vitest';
import { MassUnit } from '../../types';
import { displayToKg, kgToDisplay, massUnitLabel } from '../mass';

describe('mass utils', () => {
  it('keeps kg values as-is', () => {
    expect(kgToDisplay(100, MassUnit.KG)).toBe(100);
    expect(displayToKg(100, MassUnit.KG)).toBe(100);
    expect(massUnitLabel(MassUnit.KG)).toBe('KG');
  });

  it('converts kg to lb and back approximately', () => {
    const lb = kgToDisplay(100, MassUnit.LB);
    expect(lb).toBeCloseTo(220.46, 1);
    expect(displayToKg(lb, MassUnit.LB)).toBeCloseTo(100, 1);
    expect(massUnitLabel(MassUnit.LB)).toBe('LB');
  });
});
