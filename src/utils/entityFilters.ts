/** True when the entity is not soft-deleted */
export function isActive<T extends { deletedAt?: number | null }>(record: T): boolean {
    return record.deletedAt == null;
}

/** Filter out soft-deleted records */
export function onlyActive<T extends { deletedAt?: number | null }>(records: T[]): T[] {
    return records.filter(isActive);
}
