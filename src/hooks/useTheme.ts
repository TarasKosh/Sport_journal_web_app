import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Settings } from '../types';
import { SettingsRepository } from '../data/repositories/SettingsRepository';

function resolveTheme(theme: Settings['theme']): 'dark' | 'light' {
    if (theme === 'dark' || theme === 'light') return theme;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

function applyThemeClass(mode: 'dark' | 'light') {
    const root = document.documentElement;
    root.classList.toggle('dark', mode === 'dark');
    root.dataset.theme = mode;
}

/**
 * Reads settings.theme and applies dark/light/system to <html>.
 */
export function useTheme() {
    const settings = useLiveQuery(() => SettingsRepository.get());

    useEffect(() => {
        const theme = settings?.theme ?? 'system';
        applyThemeClass(resolveTheme(theme));

        if (theme !== 'system') return;

        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => applyThemeClass(resolveTheme('system'));
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, [settings?.theme]);

    return settings?.theme ?? 'system';
}
