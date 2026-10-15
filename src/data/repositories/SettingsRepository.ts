import { db } from '../../db/db';
import type { Settings } from '../../types';
import { defaultSettings } from '../seed';
import { nowMonotonic } from '../clock';

/** Drops the whole local database (Settings ▸ Danger Zone). The app reloads afterwards. */
export async function resetDatabase(): Promise<void> {
    await db.delete();
}

/** Settings singleton (LWW-merged during sync). */
export const SettingsRepository = {
    async get(): Promise<Settings | undefined> {
        return db.settings.toCollection().first();
    },

    /** Patches one or more settings, creating the singleton when it is missing. */
    async update(patch: Partial<Settings>): Promise<void> {
        const existing = await db.settings.toCollection().first();
        const updatedAt = nowMonotonic();
        if (!existing) {
            await db.settings.add({ ...defaultSettings(updatedAt), ...patch, updatedAt });
            return;
        }
        await db.settings.update(existing.id!, { ...patch, updatedAt });
    },
};
