import { db } from '../../db/db';
import type { ConflictLog } from '../../types';

/** Keep the conflict log bounded — it is uploaded with every snapshot. */
export const CONFLICT_RETENTION_DAYS = 90;

export const ConflictRepository = {
    async listRecent(limit = 20): Promise<ConflictLog[]> {
        const all = await db.conflictLog.toArray();
        return all
            .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))
            .slice(0, limit);
    },

    async count(): Promise<number> {
        return db.conflictLog.count();
    },

    /** Drops resolved conflicts older than the retention window. Returns rows removed. */
    async pruneOlderThan(days = CONFLICT_RETENTION_DAYS, now = Date.now()): Promise<number> {
        const cutoff = now - days * 24 * 60 * 60 * 1000;
        return db.conflictLog.filter(entry => (entry.resolvedAt ?? 0) < cutoff).delete();
    },
};
