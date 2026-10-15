import { useLiveQuery } from 'dexie-react-hooks';
import { MassUnit, RPEType, type Settings } from '../types';
import { SettingsRepository } from '../data/repositories/SettingsRepository';

export const DEFAULT_SETTINGS: Settings = {
    massUnit: MassUnit.KG,
    weightStep: 2.5,
    defaultRPEType: RPEType.RPE,
    theme: 'system',
    language: 'en',
    updatedAt: 0,
};

export function useSettings(): Settings {
    const settings = useLiveQuery(() => SettingsRepository.get());
    return settings ?? DEFAULT_SETTINGS;
}
