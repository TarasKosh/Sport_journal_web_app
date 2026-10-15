import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

/**
 * Last-resort UI guard. Before this existed a render error unmounted the whole app and
 * left a blank screen, because every failure path only called `console.error`.
 * Local data is untouched: reloading restores the app from IndexedDB.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error('Unhandled UI error', error, info.componentStack);
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleReset = () => {
        this.setState({ error: null });
    };

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-bg-primary text-text-primary">
                <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
                    <AlertTriangle className="text-danger" size={32} />
                </div>
                <h1 className="text-xl font-bold">Something went wrong</h1>
                <p className="text-sm text-text-secondary max-w-sm">
                    Your training data is stored on this device and was not affected.
                </p>
                <pre className="text-xs text-text-tertiary max-w-full overflow-x-auto bg-bg-tertiary rounded-lg p-3">
                    {error.message}
                </pre>
                <div className="flex gap-2">
                    <button
                        onClick={this.handleReset}
                        className="px-4 py-2 rounded-xl bg-bg-tertiary font-semibold"
                    >
                        Try again
                    </button>
                    <button
                        onClick={this.handleReload}
                        className="px-4 py-2 rounded-xl bg-accent text-white font-semibold"
                    >
                        Reload app
                    </button>
                </div>
            </div>
        );
    }
}
