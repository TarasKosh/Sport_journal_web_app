export const MUSCLE_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
    '#f97316', '#14b8a6', '#a855f7', '#fb7185'
];

/** Format large numbers with k/M suffixes */
export const formatNumber = (num: number): string => {
    if (!Number.isFinite(num)) return '0';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'k';
    return num.toString();
};
