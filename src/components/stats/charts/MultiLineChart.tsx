import React from 'react';
import { MUSCLE_COLORS } from './constants';
import type { MuscleWeekData } from '../../../services/stats';

export const MultiLineChart: React.FC<{ data: MuscleWeekData[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No data available
            </div>
        );
    }

    const muscleSet = new Set<string>();
    data.forEach(d => Object.keys(d.muscles).forEach(m => muscleSet.add(m)));
    const muscleGroups = Array.from(muscleSet);

    const pointSpacing = 50;
    const chartHeight = 200;
    const chartWidth = Math.max(data.length * pointSpacing + 40, 200);
    const plotHeight = chartHeight - 40;
    const plotBottom = chartHeight - 20;

    let maxVolume = 0;
    data.forEach(d => {
        Object.values(d.muscles).forEach(v => { if (v > maxVolume) maxVolume = v; });
    });
    maxVolume = Math.max(maxVolume, 1);

    return (
        <div>
            <div className="overflow-x-auto py-2">
                <svg width={chartWidth} height={chartHeight} className="min-w-full">
                    {muscleGroups.map((mg, i) => {
                        const points = data.map((d, index) => {
                            const x = index * pointSpacing + 20;
                            const volume = d.muscles[mg] || 0;
                            const y = plotBottom - (volume / maxVolume) * plotHeight;
                            return `${x},${y}`;
                        }).join(' ');

                        const color = MUSCLE_COLORS[i % MUSCLE_COLORS.length];

                        return (
                            <g key={mg}>
                                <polyline points={points} fill="none" stroke={color} strokeWidth="2" opacity={0.8} />
                                {data.map((d, index) => {
                                    const volume = d.muscles[mg] || 0;
                                    if (volume === 0) return null;
                                    const x = index * pointSpacing + 20;
                                    const y = plotBottom - (volume / maxVolume) * plotHeight;
                                    return <circle key={`${mg}-${index}`} cx={x} cy={y} r="3" fill={color} />;
                                })}
                            </g>
                        );
                    })}
                    {data.map((_, index) => {
                        const x = index * pointSpacing + 20;
                        return (
                            <text key={index} x={x} y={chartHeight - 5} textAnchor="middle" className="text-xs fill-text-secondary">
                                W{index + 1}
                            </text>
                        );
                    })}
                </svg>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
                {muscleGroups.map((mg, i) => {
                    const color = MUSCLE_COLORS[i % MUSCLE_COLORS.length];
                    return (
                        <div key={mg} className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full shadow-sm border border-black/10 flex-shrink-0"
                                style={{ backgroundColor: color }}
                            />
                            <span className="text-xs font-medium text-text-primary capitalize whitespace-nowrap">
                                {mg.replace(/_/g, ' ')}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
