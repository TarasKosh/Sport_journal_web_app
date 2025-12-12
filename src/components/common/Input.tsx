import React from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input: React.FC<InputProps> = ({
    className,
    label,
    error,
    ...props
}) => {
    return (
        <div className="flex flex-col gap-1 w-full">
            {label && <label className="text-sm text-text-secondary font-medium">{label}</label>}
            <input
                className={clsx(
                    'w-full bg-bg-tertiary border border-transparent rounded-md px-3 py-2 text-text-primary focus:outline-none focus:border-accent transition-colors',
                    error && 'border-danger',
                    className
                )}
                {...props}
            />
            {error && <span className="text-xs text-danger">{error}</span>}
        </div>
    );
};
