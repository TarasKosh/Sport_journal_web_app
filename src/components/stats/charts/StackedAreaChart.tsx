import React from 'react';
import { MUSCLE_COLORS, formatNumber } from './constants';
import type { MuscleWeekData } from '../../../services/stats';

export const StackedAreaChart: React.FC<{ data: MuscleWeekData[] }> = ({ data }) => {
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
    const chartHeight = 180;
    const chartWidth = Math.max(data.length * pointSpacing + 40, 200);
    const plotHeight = chartHeight - 40;
    const plotBottom = chartHeight - 20;

    const weekTotals = data.map(d =>
        muscleGroups.reduce((sum, mg) => sum + (d.muscles[mg] || 0), 0)
    );
    const maxValue = Math.max(...weekTotals, 1);

    const areas = muscleGroups.map((mg, mgIndex) => {
        const bottomPoints: string[] = [];
        const topPoints: string[] = [];

        data.forEach((d, i) => {
            const x = i * pointSpacing + 20;
            let baseline = 0;
            for (let j = 0; j < mgIndex; j++) {
                baseline += d.muscles[muscleGroups[j]] || 0;
            }
            const top = baseline + (d.muscles[mg] || 0);
            const yBottom = plotBottom - (baseline / maxValue) * plotHeight;
            const yTop = plotBottom - (top / maxValue) * plotHeight;
            bottomPoints.push(`${x},${yBottom}`);
            topPoints.push(`${x},${yTop}`);
        });

        const polygonPoints = [...topPoints, ...bottomPoints.reverse()].join(' ');
        const color = MUSCLE_COLORS[mgIndex % MUSCLE_COLORS.length];

        return (
            <polygon
                key={mg}
                points={polygonPoints}
                fill={color}
                opacity={0.7}
                stroke={color}
                strokeWidth="1"
            />
        );
    });

    return (
        <div>
            <div className="overflow-x-auto py-2">
                <svg width={chartWidth} height={chartHeight} className="min-w-full">
                    {areas}
                    {data.map((_, index) => {
                        const x = index * pointSpacing + 20;
                        return (
                            <text key={index} x={x} y={chartHeight - 5} textAnchor="middle" className="text-xs fill-text-secondary">
                                W{index + 1}
                            </text>
                        );
                    })}
                    {data.map((_, index) => {
                        const x = index * pointSpacing + 20;
                        const yTop = plotBottom - (weekTotals[index] / maxValue) * plotHeight;
                        return (
                            <text key={`label-${index}`} x={x} y={yTop - 6} textAnchor="middle" className="text-xs font-bold fill-text-primary">
                                {formatNumber(weekTotals[index])}
                            </text>
                        );
                    })}
                </svg>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {muscleGroups.map((mg, i) => (
                    <div key={mg} className="flex items-center gap-1.5">
                        <div
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: MUSCLE_COLORS[i % MUSCLE_COLORS.length] }}
                        />
                        <span className="text-xs text-text-secondary capitalize">{mg.replace(/_/g, ' ')}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
