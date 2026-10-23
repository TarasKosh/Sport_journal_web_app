import { RemoteSnapshotChangedError, type SyncProvider, type SyncSnapshot } from './types';
import { validateSnapshot } from './validateSnapshot';

const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const GOOGLE_GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const SNAPSHOT_FILE_NAME = 'strength-journal-snapshot.json';

interface GoogleTokenResponse {
    access_token?: string;
    error?: string;
    error_description?: string;
}

interface GoogleTokenClient {
    requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleOauth2 {
    initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
    }): GoogleTokenClient;
    revoke(token: string, callback: () => void): void;
}

interface GoogleGlobal {
    accounts: {
        oauth2: GoogleOauth2;
    };
}

declare global {
    interface Window {
        google?: GoogleGlobal;
        __googleDriveGisLoader__?: Promise<void>;
    }
}

interface DriveFileListResponse {
    files?: Array<{
        id: string;
        name: string;
        version?: number;
    }>;
}

/** Identifies a Drive file plus the revision marker used by the lost-update guard. */
interface DriveFileRevision {
    fileId: string;
    /** Drive's per-file monotonically increasing revision counter; null if Drive omits it. */
    version: number | null;
}

interface DriveFileMetadata {
    id: string;
}

async function loadScript(src: string, id: string): Promise<void> {
    if (document.getElementById(id)) {
        return;
    }

    await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

export class GoogleDriveSyncProvider implements SyncProvider {
    name = 'Google Drive';

    private accessToken: string | null = null;
    private readonly CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    private static readonly MAX_RETRIES = 3;
    private static readonly RETRY_DELAY_MS = 1000;

    /**
     * Snapshot file state as observed by the last pull(), used by push() to detect a
     * cross-device lost update (another device pushed between this device's pull and push;
     * navigator.locks only serialises tabs on one device).
     * - `undefined`: this provider never pulled — guard inactive (SyncManager always pulls first).
     * - `null`: pull saw no snapshot file — push must refuse if one appeared meanwhile.
     * - object: pull saw this file at this revision — push must refuse if id or revision changed.
     */
    private remoteRevisionAtPull: DriveFileRevision | null | undefined;

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private shouldRetry(status: number): boolean {
        return status === 429 || status >= 500;
    }

    private async retryableFetch(input: string, init: RequestInit, attempt = 0): Promise<Response> {
        try {
            const response = await fetch(input, init);
            if (this.shouldRetry(response.status) && attempt < GoogleDriveSyncProvider.MAX_RETRIES) {
                const delay = GoogleDriveSyncProvider.RETRY_DELAY_MS * Math.pow(2, attempt);
                console.warn(`Google Drive API retry ${attempt + 1}/${GoogleDriveSyncProvider.MAX_RETRIES} after ${delay}ms (status ${response.status})`);
                await this.sleep(delay);
                return this.retryableFetch(input, init, attempt + 1);
            }
            return response;
        } catch (err) {
            if (attempt < GoogleDriveSyncProvider.MAX_RETRIES) {
                const delay = GoogleDriveSyncProvider.RETRY_DELAY_MS * Math.pow(2, attempt);
                console.warn(`Google Drive API network retry ${attempt + 1}/${GoogleDriveSyncProvider.MAX_RETRIES} after ${delay}ms`, err);
                await this.sleep(delay);
                return this.retryableFetch(input, init, attempt + 1);
            }
            throw err;
        }
    }

    private ensureConfigured(): void {
        if (!this.CLIENT_ID) {
            throw new Error('Google Drive sync is not configured. Set VITE_GOOGLE_CLIENT_ID in a local .env file and restart the app.');
        }
    }

    private async ensureGoogleIdentity(): Promise<GoogleGlobal> {
        if (!window.__googleDriveGisLoader__) {
            window.__googleDriveGisLoader__ = loadScript(GOOGLE_GIS_SCRIPT_SRC, 'google-drive-gis-client');
        }

        await window.__googleDriveGisLoader__;

        const google = window.google;
        if (!google?.accounts?.oauth2) {
            throw new Error('Google Identity Services failed to initialize.');
        }

        return google;
    }

    async connect(): Promise<void> {
        this.ensureConfigured();

        if (this.accessToken) {
            return;
        }

        const google = await this.ensureGoogleIdentity();

        await new Promise<void>((resolve, reject) => {
            const tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: GOOGLE_DRIVE_SCOPE,
                callback: (response: GoogleTokenResponse) => {
                    if (response.error || !response.access_token) {
                        reject(new Error(response.error_description || response.error || 'Google authentication failed.'));
                        return;
                    }

                    this.accessToken = response.access_token;
                    resolve();
                },
            });

            tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }

    async disconnect(): Promise<void> {
        // The session is over: any revision captured by a previous pull is stale.
        this.remoteRevisionAtPull = undefined;

        if (!this.accessToken) {
            return;
        }

        const google = await this.ensureGoogleIdentity();
        const token = this.accessToken;

        await new Promise<void>((resolve) => {
            google.accounts.oauth2.revoke(token, () => resolve());
        });

        this.accessToken = null;
    }

    async isAuthenticated(): Promise<boolean> {
        return !!this.accessToken;
    }

    private async driveRequest(
        input: string,
        init: RequestInit = {},
        allowReconnect = true,
    ): Promise<Response> {
        if (!this.accessToken) {
            await this.connect();
        }

        const headers = new Headers(init.headers);
        headers.set('Authorization', `Bearer ${this.accessToken}`);

        const response = await this.retryableFetch(input, {
            ...init,
            headers,
        });

        if (response.status === 401 && allowReconnect) {
            this.accessToken = null;
            await this.connect();
            return this.driveRequest(input, init, false);
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google Drive request failed (${response.status}): ${errorText || response.statusText}`);
        }

        return response;
    }

    private async findSnapshotFile(): Promise<DriveFileRevision | null> {
        const query = encodeURIComponent(`name = '${SNAPSHOT_FILE_NAME}' and 'appDataFolder' in parents and trashed = false`);
        const response = await this.driveRequest(
            `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,version)&pageSize=1&q=${query}`,
        );
        const payload = await response.json() as DriveFileListResponse;
        const file = payload.files?.[0];

        if (!file) {
            return null;
        }
        return {
            fileId: file.id,
            version: typeof file.version === 'number' ? file.version : null,
        };
    }

    async pull(): Promise<SyncSnapshot | null> {
        const file = await this.findSnapshotFile();
        this.remoteRevisionAtPull = file;

        if (!file) {
            return null;
        }

        const response = await this.driveRequest(`https://www.googleapis.com/drive/v3/files/${file.fileId}?alt=media`);
        const raw = await response.json() as unknown;
        return validateSnapshot(raw);
    }

    /**
     * Cross-device lost-update guard: refuses to overwrite a snapshot that changed since the
     * pull() of this same provider instance. Without it, device B pushing stale merge results
     * would silently drop device A's rows from the cloud copy until A syncs again.
     */
    private assertRemoteUnchangedSincePull(currentFile: DriveFileRevision | null): void {
        if (this.remoteRevisionAtPull === undefined) {
            return;
        }

        const changed = this.remoteRevisionAtPull === null
            ? currentFile !== null
            : currentFile === null
              || currentFile.fileId !== this.remoteRevisionAtPull.fileId
              || currentFile.version !== this.remoteRevisionAtPull.version;

        if (changed) {
            throw new RemoteSnapshotChangedError();
        }
    }

    async push(snapshot: SyncSnapshot): Promise<void> {
        const body = JSON.stringify(snapshot, null, 2);
        const currentFile = await this.findSnapshotFile();
        this.assertRemoteUnchangedSincePull(currentFile);

        let fileId = currentFile?.fileId;

        if (!fileId) {
            const createResponse = await this.driveRequest('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: SNAPSHOT_FILE_NAME,
                    parents: ['appDataFolder'],
                }),
            });

            const metadata = await createResponse.json() as DriveFileMetadata;
            fileId = metadata.id;
        }

        await this.driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body,
        });
    }
}
