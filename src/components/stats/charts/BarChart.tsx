import React from 'react';

export const BarChart: React.FC<{ data: { week: string; count: number }[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="h-40 flex items-center justify-center text-text-tertiary">
                No data available
            </div>
        );
    }

    const maxValue = Math.max(...data.map(item => item.count), 1);
    const barWidth = 30;
    const barSpacing = 10;
    const chartHeight = 160;

    return (
        <div className="overflow-x-auto py-2">
            <svg width={data.length * (barWidth + barSpacing)} height={chartHeight} className="min-w-full">
                {data.map((item, index) => {
                    const barHeight = (item.count / maxValue) * (chartHeight - 40);
                    const x = index * (barWidth + barSpacing) + barSpacing;
                    const y = chartHeight - barHeight - 20;

                    return (
                        <g key={index}>
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                className="fill-primary"
                                rx="4"
                            />
                            <text
                                x={x + barWidth / 2}
                                y={chartHeight - 5}
                                textAnchor="middle"
                                className="text-xs fill-text-secondary"
                            >
                                W{index + 1}
                            </text>
                            {item.count > 0 && (
                                <text
                                    x={x + barWidth / 2}
                                    y={y - 5}
                                    textAnchor="middle"
                                    className="text-xs font-bold fill-text-primary"
                                >
                                    {item.count}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};
