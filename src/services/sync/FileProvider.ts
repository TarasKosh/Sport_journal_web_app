import type { SyncProvider, SyncSnapshot } from './types';

export class FileSyncProvider implements SyncProvider {
    name = "File Export/Import";

    async connect() { return; }
    async disconnect() { return; }
    async isAuthenticated() { return true; }

    async pull(): Promise<SyncSnapshot | null> {
        // File provider 'pull' is triggered via UI file picker, not automatically.
        // So this might return null or throw saying "Use importFile method".
        return null;
    }

    async push(snapshot: SyncSnapshot): Promise<void> {
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `strength-journal-${new Date(snapshot.exportedAt).toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Helper for UI to call when file is selected
    async importFile(file: File): Promise<SyncSnapshot> {
        const text = await file.text();
        return JSON.parse(text) as SyncSnapshot;
    }
}
