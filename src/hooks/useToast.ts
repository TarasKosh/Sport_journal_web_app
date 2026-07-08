import { useContext } from 'react';
import { ToastContext, type ToastContextValue } from '../components/common/toastContext';

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        return {
            showToast: (message: string) => {
                console.info('[toast]', message);
            },
        };
    }
    return ctx;
}
