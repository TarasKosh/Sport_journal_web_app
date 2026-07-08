export function safeNum(v: unknown): number {
    return Number(v) || 0;
}

export { isActive, onlyActive } from './entityFilters';
export { kgToDisplay, displayToKg, massUnitLabel } from './mass';
