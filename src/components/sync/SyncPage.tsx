import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { SyncManager } from '../../services/sync/SyncManager';
import { FileSyncProvider } from '../../services/sync/FileProvider';
import { GoogleDriveSyncProvider } from '../../services/sync/GoogleDriveProvider';
import { Upload, Download, RefreshCw, Cloud } from 'lucide-react';

export const SyncPage: React.FC = () => {
    const [status, setStatus] = useState<string>('');
    const [isSyncing, setIsSyncing] = useState(false);

    const handleFileExport = async () => {
        try {
            const provider = new FileSyncProvider();
            const manager = new SyncManager(provider);
            const snapshot = await manager.createSnapshot();
            await provider.push(snapshot);
            setStatus('Export successful');
        } catch (e) {
            console.error(e);
            setStatus('Export failed');
        }
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const provider = new FileSyncProvider();
            const manager = new SyncManager(provider);
            const snapshot = await provider.importFile(file);
            await manager.mergeSnapshot(snapshot);
            setStatus('Import and Merge successful');
            alert('Data imported successfully!');
            // Reload to reflect changes? Or relies on live query. Live query handles it.
        } catch (e) {
            console.error(e);
            setStatus('Import failed');
            alert('Import failed (check console)');
        }
    };

    const handleDriveSync = async () => {
        setIsSyncing(true);
        setStatus('Connecting to Drive...');

        try {
            const provider = new GoogleDriveSyncProvider();
            const manager = new SyncManager(provider);
            await manager.sync();
            setStatus('Google Drive Sync Complete');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.error(e);
            setStatus('Sync Failed: ' + (e.message || String(e)));
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="p-4 flex flex-col gap-4">
            <h1 className="text-xl font-bold">Synchronization</h1>

            <Card className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <Cloud className="text-accent" />
                    <h2 className="font-bold">Google Drive</h2>
                </div>
                <p className="text-sm text-text-secondary">Sync your data to a private app folder in your Google Drive.</p>

                <Button onClick={handleDriveSync} disabled={isSyncing} fullWidth>
                    {isSyncing ? <RefreshCw className="animate-spin mr-2" /> : <RefreshCw className="mr-2" />}
                    Sync Now
                </Button>
                {status && <p className="text-xs text-center text-text-tertiary">{status}</p>}
            </Card>

            <Card className="flex flex-col gap-4">
                <h2 className="font-bold">Manual Backup</h2>
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={handleFileExport} className="flex-1">
                        <Download className="mr-2" size={16} /> Export JSON
                    </Button>
                </div>

                <div className="relative">
                    <Button variant="secondary" fullWidth>
                        <Upload className="mr-2" size={16} /> Import JSON
                    </Button>
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleFileImport}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                </div>
                <p className="text-xs text-text-secondary text-center">Importing will merge with existing data.</p>
            </Card>
        </div>
    );
};
