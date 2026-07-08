import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { MassUnit, RPEType, type Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
    massUnit: MassUnit.KG,
    weightStep: 2.5,
    defaultRPEType: RPEType.RPE,
    theme: 'system',
    language: 'en',
    updatedAt: 0,
};

export function useSettings(): Settings {
    const settings = useLiveQuery(() => db.settings.toCollection().first());
    return settings ?? DEFAULT_SETTINGS;
}
