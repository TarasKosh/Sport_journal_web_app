import React from 'react';
import { formatNumber } from './constants';

const PIE_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

const CENTER_X = 80;
const CENTER_Y = 80;
const RADIUS = 60;

function computeSlices(data: { name: string; volume: number }[], total: number) {
    const limited = data.slice(0, 8);
    let cumulativeAngle = 0;

    return limited.map((item) => {
        const sliceAngle = (item.volume / total) * 360;
        const startAngle = cumulativeAngle;
        const endAngle = cumulativeAngle + sliceAngle;
        cumulativeAngle = endAngle;

        const startRad = (startAngle - 90) * Math.PI / 180;
        const endRad = (endAngle - 90) * Math.PI / 180;

        const x1 = CENTER_X + RADIUS * Math.cos(startRad);
        const y1 = CENTER_Y + RADIUS * Math.sin(startRad);
        const x2 = CENTER_X + RADIUS * Math.cos(endRad);
        const y2 = CENTER_Y + RADIUS * Math.sin(endRad);
        const largeArcFlag = sliceAngle > 180 ? 1 : 0;

        return `M ${CENTER_X} ${CENTER_Y} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
    });
}

export const PieChart: React.FC<{ data: { name: string; volume: number }[] }> = ({ data }) => {
    const total = data.reduce((sum, item) => sum + item.volume, 0);

    const paths = React.useMemo(() => {
        if (data.length === 0 || total === 0) return [];
        return computeSlices(data, total);
    }, [data, total]);

    if (data.length === 0 || total === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No data available
            </div>
        );
    }

    return (
        <div className="flex justify-center py-2">
            <svg width="160" height="160" viewBox="0 0 160 160">
                {paths.map((d, index) => (
                    <path key={index} d={d} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="#fff" strokeWidth="1" />
                ))}
                <circle cx={CENTER_X} cy={CENTER_Y} r="20" fill="#fff" />
                <text x={CENTER_X} y={CENTER_Y - 5} textAnchor="middle" className="text-xs font-bold fill-text-primary">
                    {formatNumber(total)}
                </text>
                <text x={CENTER_X} y={CENTER_Y + 10} textAnchor="middle" className="text-xs fill-text-secondary">
                    Total
                </text>
            </svg>
        </div>
    );
};
