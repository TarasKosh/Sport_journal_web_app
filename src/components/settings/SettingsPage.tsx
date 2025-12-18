import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Card } from '../common/Card';
import { MassUnit } from '../../types';
import { SyncPage } from '../sync/SyncPage';

export const SettingsPage: React.FC = () => {
    // We assume ID 1 for settings. Or first record.
    const settings = useLiveQuery(() => db.settings.toCollection().first());

    const updateSetting = async (key: string, value: any) => {
        if (settings) {
            await db.settings.update(settings.id!, { [key]: value });
        } else {
            // Should be seeded, but fallback
            await db.settings.add({ [key]: value } as any);
        }
    };

    if (!settings) return <div>Loading...</div>;

    return (
        <div className="p-4 flex flex-col gap-4">
            <h1 className="text-xl font-bold">Settings</h1>

            <Card>
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <label className="font-medium">Mass Unit</label>
                        <select
                            className="bg-bg-tertiary border border-transparent rounded px-2 py-1"
                            value={settings.massUnit}
                            onChange={(e) => updateSetting('massUnit', e.target.value)}
                        >
                            <option value={MassUnit.KG}>Kilograms (kg)</option>
                            <option value={MassUnit.LB}>Pounds (lb)</option>
                        </select>
                    </div>

                    <div className="flex justify-between items-center">
                        <label className="font-medium">Theme</label>
                        <select
                            className="bg-bg-tertiary border border-transparent rounded px-2 py-1"
                            value={settings.theme}
                            onChange={(e) => updateSetting('theme', e.target.value)}
                        >
                            <option value="system">System</option>
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                        </select>
                    </div>
                </div>
            </Card>

            <SyncPage />

            <Card className="bg-danger/10 border-2 border-danger/30">
                <h3 className="text-sm font-bold text-danger mb-2">Danger Zone</h3>
                <button
                    onClick={async () => {
                        if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
                            await db.delete();
                            window.location.reload();
                        }
                    }}
                    className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors shadow-md"
                >
                    🗑️ Reset Database
                </button>
                <p className="text-xs text-text-secondary mt-2">
                    This will delete all workouts, exercises, and settings. The database will be recreated with default exercises.
                </p>
            </Card>

            <Card className="bg-bg-tertiary/50">
                <h3 className="text-sm font-bold opacity-50 mb-2">About</h3>
                <p className="text-xs text-text-secondary">
                    Strength Training Journal v0.1.0<br />
                    Offline First PWA<br />
                    Data stored locally on device.
                </p>
            </Card>
        </div>
    );
};
