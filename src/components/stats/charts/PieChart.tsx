import React from 'react';
import { formatNumber } from './constants';

const PIE_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

export const PieChart: React.FC<{ data: { name: string; volume: number }[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No data available
            </div>
        );
    }

    const total = data.reduce((sum, item) => sum + item.volume, 0);
    if (total === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No data available
            </div>
        );
    }

    const centerX = 80;
    const centerY = 80;
    const radius = 60;
    let startAngle = 0;

    return (
        <div className="flex justify-center py-2">
            <svg width="160" height="160" viewBox="0 0 160 160">
                {data.slice(0, 8).map((item, index) => {
                    const sliceAngle = (item.volume / total) * 360;
                    const endAngle = startAngle + sliceAngle;
                    const startRad = (startAngle - 90) * Math.PI / 180;
                    const endRad = (endAngle - 90) * Math.PI / 180;

                    const x1 = centerX + radius * Math.cos(startRad);
                    const y1 = centerY + radius * Math.sin(startRad);
                    const x2 = centerX + radius * Math.cos(endRad);
                    const y2 = centerY + radius * Math.sin(endRad);
                    const largeArcFlag = sliceAngle > 180 ? 1 : 0;

                    const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
                    const color = PIE_COLORS[index % PIE_COLORS.length];
                    startAngle = endAngle;

                    return <path key={index} d={pathData} fill={color} stroke="#fff" strokeWidth="1" />;
                })}
                <circle cx={centerX} cy={centerY} r="20" fill="#fff" />
                <text x={centerX} y={centerY - 5} textAnchor="middle" className="text-xs font-bold fill-text-primary">
                    {formatNumber(total)}
                </text>
                <text x={centerX} y={centerY + 10} textAnchor="middle" className="text-xs fill-text-secondary">
                    Total
                </text>
            </svg>
        </div>
    );
};
