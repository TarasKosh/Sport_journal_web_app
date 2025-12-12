import React from 'react';
import clsx from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'outlined';
}

export const Card: React.FC<CardProps> = ({ className, children, variant = 'default', ...props }) => {
    return (
        <div
            className={clsx(
                'rounded-lg p-4 transition-all',
                variant === 'default' && 'bg-bg-secondary shadow-sm',
                variant === 'outlined' && 'border border-border bg-transparent',
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};
