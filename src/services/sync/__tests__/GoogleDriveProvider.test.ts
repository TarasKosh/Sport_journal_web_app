import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleDriveSyncProvider } from '../GoogleDriveProvider';
import { RemoteSnapshotChangedError, type SyncSnapshot } from '../types';
import { SCHEMA_VERSION } from '../validateSnapshot';

const SNAPSHOT_FILE_NAME = 'strength-journal-snapshot.json';

type FakeDriveFile = {
    id: string;
    name: string;
    version: number;
    content: unknown;
};

/** Minimal snapshot that passes validateSnapshot(). */
function makeSnapshot(): SyncSnapshot {
    return {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: 1_700_000_000_000,
        deviceId: 'device-a',
        data: {
            settings: [],
            exercises: [],
            workouts: [],
            workoutExercises: [],
            sets: [],
            workoutTemplates: [],
            conflictLog: [],
        },
    };
}

function fakeResponse(body: unknown, status = 200): Response {
    const text = JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: 'OK',
        json: async () => JSON.parse(text),
        text: async () => text,
    } as unknown as Response;
}

let driveFiles: Map<string, FakeDriveFile>;
let fetchMock: ReturnType<typeof vi.fn>;

/** Mocks the exact Drive REST endpoints GoogleDriveSyncProvider calls. */
function installDriveFetch(): void {
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = new URL(input.toString());
        const method = init?.method ?? 'GET';

        // Metadata list (findSnapshotFile).
        if (url.origin === 'https://www.googleapis.com' && url.pathname === '/drive/v3/files' && method === 'GET') {
            const files = [...driveFiles.values()].map(file => ({
                id: file.id,
                name: file.name,
                version: file.version,
            }));
            return fakeResponse({ files });
        }

        // Snapshot content download.
        if (url.pathname.startsWith('/drive/v3/files/') && url.searchParams.get('alt') === 'media') {
            const id = url.pathname.slice('/drive/v3/files/'.length);
            const file = driveFiles.get(id);
            if (!file) return fakeResponse({ error: 'File not found.' }, 404);
            return fakeResponse(file.content);
        }

        // Snapshot file creation.
        if (url.pathname === '/drive/v3/files' && method === 'POST') {
            const id = `file-${driveFiles.size + 1}`;
            driveFiles.set(id, { id, name: SNAPSHOT_FILE_NAME, version: 1, content: null });
            return fakeResponse({ id, name: SNAPSHOT_FILE_NAME });
        }

        // Media upload over the existing snapshot file.
        if (url.pathname.startsWith('/upload/drive/v3/files/')) {
            const id = url.pathname.slice('/upload/drive/v3/files/'.length);
            const file = driveFiles.get(id);
            if (!file) return fakeResponse({ error: 'File not found.' }, 404);
            file.content = init?.body != null ? JSON.parse(String(init.body)) : null;
            file.version += 1;
            return fakeResponse({ id, version: file.version });
        }

        throw new Error(`Unexpected Drive request: ${method} ${url.toString()}`);
    });
    vi.stubGlobal('fetch', fetchMock);
}

/** Replaces Google Identity Services with an immediate token grant. */
function installGoogleIdentity(): void {
    window.__googleDriveGisLoader__ = Promise.resolve();
    window.google = {
        accounts: {
            oauth2: {
                initTokenClient(config) {
                    return {
                        requestAccessToken() {
                            config.callback({ access_token: 'test-access-token' });
                        },
                    };
                },
                revoke(_token, done) {
                    done();
                },
            },
        },
    };
}

function installSnapshotFile(version: number): FakeDriveFile {
    const file: FakeDriveFile = { id: 'snap-file', name: SNAPSHOT_FILE_NAME, version, content: makeSnapshot() };
    driveFiles.set(file.id, file);
    return file;
}

/** Requests that would modify the remote snapshot (file create or media upload). */
function mutatingRequests() {
    return fetchMock.mock.calls.filter(([url, init]) => {
        const path = new URL(url.toString()).pathname;
        const method = init?.method ?? 'GET';
        return path.startsWith('/upload/drive/v3/files/') || (path === '/drive/v3/files' && method === 'POST');
    });
}

describe('GoogleDriveSyncProvider push revision guard', () => {
    beforeEach(() => {
        driveFiles = new Map();
        installGoogleIdentity();
        installDriveFetch();
        vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        delete window.google;
        window.__googleDriveGisLoader__ = undefined;
    });

    it('pulls the snapshot and uploads when the remote revision is unchanged', async () => {
        const provider = new GoogleDriveSyncProvider();
        installSnapshotFile(3);

        const pulled = await provider.pull();
        expect(pulled).not.toBeNull();
        expect(pulled?.deviceId).toBe('device-a');

        await provider.push(makeSnapshot());

        const uploads = mutatingRequests();
        expect(uploads).toHaveLength(1);
        expect(new URL(uploads[0][0].toString()).pathname).toBe('/upload/drive/v3/files/snap-file');
        expect(uploads[0][1]?.method).toBe('PATCH');
    });

    it('refuses to push when the remote revision changed since pull', async () => {
        const provider = new GoogleDriveSyncProvider();
        const file = installSnapshotFile(3);
        await provider.pull();

        // Another device uploads in the meantime: Drive bumps the file revision.
        file.version = 4;
        file.content = makeSnapshot();

        const pushPromise = provider.push(makeSnapshot());
        await expect(pushPromise).rejects.toBeInstanceOf(RemoteSnapshotChangedError);
        await expect(pushPromise).rejects.toThrow(/run sync again to pick up the latest data/);
        expect(mutatingRequests()).toHaveLength(0);
    });

    it('refuses to push when the snapshot file appeared after a pull that saw no file', async () => {
        const provider = new GoogleDriveSyncProvider();

        const pulled = await provider.pull();
        expect(pulled).toBeNull();

        // Another device creates the snapshot while this device is merging.
        installSnapshotFile(1);

        await expect(provider.push(makeSnapshot())).rejects.toBeInstanceOf(RemoteSnapshotChangedError);
        expect(mutatingRequests()).toHaveLength(0);
    });

    it('creates and uploads the snapshot when no file existed at pull time and none exists now', async () => {
        const provider = new GoogleDriveSyncProvider();

        const pulled = await provider.pull();
        expect(pulled).toBeNull();

        await provider.push(makeSnapshot());

        const requests = mutatingRequests();
        const create = requests.find(([url, init]) =>
            new URL(url.toString()).pathname === '/drive/v3/files' && init?.method === 'POST');
        const upload = requests.find(([url]) =>
            new URL(url.toString()).pathname.startsWith('/upload/drive/v3/files/'));
        expect(create).toBeTruthy();
        expect(upload).toBeTruthy();
    });

    it('clears the remembered revision on disconnect', async () => {
        const provider = new GoogleDriveSyncProvider();
        const file = installSnapshotFile(3);
        await provider.pull();

        await provider.disconnect();

        // The remote moved on while this provider was disconnected; a stale guard would
        // refuse the push even though the next pull will re-read the current state.
        file.version = 7;
        file.content = makeSnapshot();

        await provider.push(makeSnapshot());
        expect(mutatingRequests()).toHaveLength(1);
    });
});
