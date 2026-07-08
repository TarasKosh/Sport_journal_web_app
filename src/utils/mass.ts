import { MassUnit } from '../types';

const LB_PER_KG = 2.2046226218;

/** Stored weight is always in kg internally */
export function kgToDisplay(kg: number, unit: MassUnit): number {
    if (unit === MassUnit.LB) {
        return Math.round(kg * LB_PER_KG * 100) / 100;
    }
    return kg;
}

export function displayToKg(value: number, unit: MassUnit): number {
    if (unit === MassUnit.LB) {
        return Math.round((value / LB_PER_KG) * 1000) / 1000;
    }
    return value;
}

export function massUnitLabel(unit: MassUnit): string {
    return unit === MassUnit.LB ? 'LB' : 'KG';
}
