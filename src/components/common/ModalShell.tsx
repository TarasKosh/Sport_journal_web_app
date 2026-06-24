import React, { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ModalShellProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    titleId: string;
    gradientHeader?: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    children: ReactNode;
    footer?: ReactNode;
    height?: 'auto' | 'full' | '90vh';
    header?: ReactNode;
}

const maxWidthClasses: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full',
};

const heightClasses: Record<string, string> = {
    auto: '',
    full: 'h-full sm:h-[95vh]',
    '90vh': 'h-[90vh] sm:h-[85vh]',
};

export const ModalShell: React.FC<ModalShellProps> = ({
    isOpen,
    onClose,
    title,
    titleId,
    gradientHeader = true,
    maxWidth = '2xl',
    children,
    footer,
    height = '90vh',
    header,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useFocusTrap(isOpen, containerRef);

    if (!isOpen) return null;

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className={`bg-bg-primary w-full ${maxWidthClasses[maxWidth] || 'max-w-2xl'} ${heightClasses[height] || 'h-[90vh] sm:h-[85vh]'} flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up`}
            >
                {header ? header : (
                    gradientHeader ? (
                        <div className="bg-gradient-to-br from-accent to-accent-hover text-white p-6 pb-5 flex-shrink-0">
                            <div className="flex justify-between items-center">
                                <h2 id={titleId} className="text-2xl font-bold">{title}</h2>
                                <button
                                    onClick={onClose}
                                    className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                                    aria-label="Close"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center p-4 border-b border-border flex-shrink-0">
                            <h2 id={titleId} className="text-lg font-bold">{title}</h2>
                            <button onClick={onClose} className="text-text-secondary hover:text-text-primary" aria-label="Close">
                                <X size={24} />
                            </button>
                        </div>
                    )
                )}

                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>

                {footer && (
                    <div className="p-4 border-t border-border bg-bg-secondary flex-shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
