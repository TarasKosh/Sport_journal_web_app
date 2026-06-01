import React from 'react';
import { formatNumber } from './constants';

export const LineChart: React.FC<{ data: { week: string; tonnage: number }[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No data available
            </div>
        );
    }

    const maxValue = Math.max(...data.map(item => item.tonnage), 1);
    const pointSpacing = 40;
    const chartHeight = 160;
    const chartWidth = Math.max(data.length * pointSpacing, 200);

    const points = data.map((item, index) => {
        const x = index * pointSpacing + 20;
        const y = chartHeight - 20 - (item.tonnage / maxValue) * (chartHeight - 40);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="overflow-x-auto py-2">
            <svg width={chartWidth} height={chartHeight} className="min-w-full">
                <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2" />
                {data.map((item, index) => {
                    const cx = index * pointSpacing + 20;
                    const cy = chartHeight - 20 - (item.tonnage / maxValue) * (chartHeight - 40);
                    return (
                        <g key={index}>
                            <circle cx={cx} cy={cy} r="4" className="fill-primary" />
                            <text x={cx} y={chartHeight - 5} textAnchor="middle" className="text-xs fill-text-secondary">
                                W{index + 1}
                            </text>
                            <text x={cx} y={cy - 10} textAnchor="middle" className="text-xs font-bold fill-text-primary">
                                {formatNumber(item.tonnage)}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};
