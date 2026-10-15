import type { Collection } from 'dexie';

/** IndexedDB/Dexie degrade badly with thousands of keys in a single `anyOf`, so batch. */
export const ANY_OF_CHUNK_SIZE = 200;

/**
 * Fetches rows for many index keys in bounded chunks.
 * `collectionFactory` receives a chunk and must return the prepared collection.
 * `TKey` is the table's primary key type (a number for this schema) and is inferred.
 */
export async function fetchByAnyOf<T, TKey = number>(
    collectionFactory: (keys: string[]) => Collection<T, TKey>,
    keys: string[],
): Promise<T[]> {
    const unique = [...new Set(keys)];
    if (unique.length === 0) return [];

    const rows: T[] = [];
    for (let index = 0; index < unique.length; index += ANY_OF_CHUNK_SIZE) {
        const chunk = unique.slice(index, index + ANY_OF_CHUNK_SIZE);
        rows.push(...(await collectionFactory(chunk).toArray()));
    }
    return rows;
}
