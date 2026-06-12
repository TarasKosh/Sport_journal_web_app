import React from 'react';

export const WeightLineChart: React.FC<{ data: { week: string; weight: number }[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No body weight data available
            </div>
        );
    }

    const minWeight = Math.max(Math.min(...data.map(item => item.weight)) - 5, 0);
    const maxWeight = Math.max(...data.map(item => item.weight)) + 5;
    const range = Math.max(maxWeight - minWeight, 1);
    const pointSpacing = 40;
    const chartHeight = 160;
    const chartWidth = Math.max(data.length * pointSpacing, 200);

    const points = data.map((item, index) => {
        const x = index * pointSpacing + 20;
        const y = chartHeight - 20 - ((item.weight - minWeight) / range) * (chartHeight - 40);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="overflow-x-auto py-2">
            <svg width={chartWidth} height={chartHeight} className="min-w-full">
                <polyline points={points} fill="none" stroke="#10b981" strokeWidth="2" />
                {data.map((item, index) => {
                    const cx = index * pointSpacing + 20;
                    const cy = chartHeight - 20 - ((item.weight - minWeight) / range) * (chartHeight - 40);
                    return (
                        <g key={index}>
                            <circle cx={cx} cy={cy} r="4" className="fill-success" />
                            <text x={cx} y={chartHeight - 5} textAnchor="middle" className="text-xs fill-text-secondary">
                                {item.week}
                            </text>
                            <text x={cx} y={cy - 10} textAnchor="middle" className="text-xs font-bold fill-text-primary">
                                {item.weight.toFixed(1)}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};
