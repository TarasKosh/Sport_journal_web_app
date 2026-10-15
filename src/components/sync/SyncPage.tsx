import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { SyncManager } from '../../services/sync/SyncManager';
import { FileSyncProvider } from '../../services/sync/FileProvider';
import { GoogleDriveSyncProvider } from '../../services/sync/GoogleDriveProvider';
import { ConflictRepository } from '../../data/repositories/ConflictRepository';
import { Upload, Download, RefreshCw, Cloud, AlertTriangle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

export const SyncPage: React.FC = () => {
    const [status, setStatus] = useState<string>('');
    const [isSyncing, setIsSyncing] = useState(false);
    const { showToast } = useToast();

    // Read-only view of the conflict log maintained by the sync merge.
    const conflictCount = useLiveQuery(() => ConflictRepository.count(), []);
    const recentConflicts = useLiveQuery(() => ConflictRepository.listRecent(10), []);

    const handleFileExport = async () => {
        try {
            const provider = new FileSyncProvider();
            const manager = new SyncManager(provider);
            const snapshot = await manager.createSnapshot();
            await provider.push(snapshot);
            setStatus('Export successful');
            showToast('Export successful', 'success');
        } catch (e) {
            console.error(e);
            setStatus('Export failed');
            showToast('Export failed', 'error');
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
            showToast('Data imported successfully', 'success');
        } catch (e) {
            console.error(e);
            const message = e instanceof Error ? e.message : 'Import failed';
            setStatus(`Import failed: ${message}`);
            showToast(message, 'error');
        } finally {
            e.target.value = '';
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
            showToast('Google Drive sync complete', 'success');
        } catch (e: unknown) {
            console.error(e);
            const message = e instanceof Error ? e.message : String(e);
            setStatus('Sync Failed: ' + message);
            showToast('Sync failed: ' + message, 'error');
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
                {status && <p className="text-xs text-center text-text-tertiary" role="status">{status}</p>}
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
                        accept=".json,application/json"
                        onChange={handleFileImport}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        aria-label="Import JSON file"
                    />
                </div>
                <p className="text-xs text-text-secondary text-center">Importing will merge with existing data (last write wins).</p>
            </Card>

            <Card className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="text-accent" size={18} />
                    <h2 className="font-bold">Conflicts</h2>
                </div>
                {conflictCount == null || recentConflicts == null ? (
                    <p className="text-sm text-text-secondary">Loading conflicts...</p>
                ) : (
                    <>
                        <p className="text-sm text-text-secondary">
                            {conflictCount === 0
                                ? 'No sync conflicts recorded.'
                                : `${conflictCount} sync conflict${conflictCount === 1 ? '' : 's'} recorded.`}
                        </p>
                        {recentConflicts.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b-2 border-border text-text-tertiary text-xs uppercase font-bold tracking-wider">
                                            <th className="text-left py-2 px-2">Entity</th>
                                            <th className="text-left py-2 px-2">Resolution</th>
                                            <th className="text-right py-2 px-2">Resolved</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentConflicts.map(conflict => (
                                            <tr key={conflict.uuid} className="border-b border-border/30">
                                                <td className="py-2 px-2 text-text-primary capitalize">{conflict.entityType}</td>
                                                <td className="py-2 px-2 text-text-secondary capitalize">{conflict.resolution ?? '—'}</td>
                                                <td className="py-2 px-2 text-right text-text-secondary">
                                                    {conflict.resolvedAt != null
                                                        ? new Date(conflict.resolvedAt).toLocaleDateString()
                                                        : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </Card>
        </div>
    );
};
