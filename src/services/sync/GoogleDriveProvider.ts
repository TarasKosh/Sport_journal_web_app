import type { SyncProvider, SyncSnapshot } from './types';

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
    }>;
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

        const response = await fetch(input, {
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

    private async findSnapshotFileId(): Promise<string | null> {
        const query = encodeURIComponent(`name = '${SNAPSHOT_FILE_NAME}' and 'appDataFolder' in parents and trashed = false`);
        const response = await this.driveRequest(
            `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)&pageSize=1&q=${query}`,
        );
        const payload = await response.json() as DriveFileListResponse;

        return payload.files?.[0]?.id ?? null;
    }

    async pull(): Promise<SyncSnapshot | null> {
        const fileId = await this.findSnapshotFileId();
        if (!fileId) {
            return null;
        }

        const response = await this.driveRequest(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
        return await response.json() as SyncSnapshot;
    }

    async push(snapshot: SyncSnapshot): Promise<void> {
        const body = JSON.stringify(snapshot, null, 2);
        let fileId = await this.findSnapshotFileId();

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
