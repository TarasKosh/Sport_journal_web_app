import React from 'react';
import clsx from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    className,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    children,
    ...props
}) => {
    return (
        <button
            className={clsx(
                'btn', // from index.css
                variant === 'primary' && 'btn-primary',
                variant === 'secondary' && 'btn-secondary',
                variant === 'ghost' && 'bg-transparent hover:bg-bg-tertiary',
                variant === 'danger' && 'bg-danger text-white hover:bg-opacity-90',
                size === 'sm' && 'text-sm px-3 py-1',
                size === 'md' && 'px-4 py-2',
                size === 'lg' && 'text-lg px-6 py-3',
                size === 'icon' && 'btn-icon p-2',
                fullWidth && 'w-full flex',
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
};
