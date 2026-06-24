import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModalShell } from '../ModalShell';

describe('ModalShell', () => {
    it('renders nothing when isOpen is false', () => {
        const { container } = render(
            <ModalShell isOpen={false} onClose={vi.fn()} title="Test" titleId="test-id">
                <div>Content</div>
            </ModalShell>
        );
        expect(container.innerHTML).toBe('');
    });

    it('renders content when isOpen is true', () => {
        render(
            <ModalShell isOpen={true} onClose={vi.fn()} title="Test Modal" titleId="test-id">
                <div>Modal Content</div>
            </ModalShell>
        );
        expect(screen.getByText('Modal Content')).toBeInTheDocument();
        expect(screen.getByText('Test Modal')).toBeInTheDocument();
    });

    it('calls onClose when Escape is pressed', () => {
        const onClose = vi.fn();
        render(
            <ModalShell isOpen={true} onClose={onClose} title="Test" titleId="test-id">
                <div>Content</div>
            </ModalShell>
        );
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking backdrop', () => {
        const onClose = vi.fn();
        render(
            <ModalShell isOpen={true} onClose={onClose} title="Test" titleId="test-id">
                <div>Content</div>
            </ModalShell>
        );
        const backdrop = screen.getByRole('dialog');
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders with gradient header by default', () => {
        render(
            <ModalShell isOpen={true} onClose={vi.fn()} title="Gradient" titleId="test-id">
                <div>Content</div>
            </ModalShell>
        );
        const title = screen.getByText('Gradient');
        expect(title.className).toContain('font-bold');
    });

    it('renders custom header when header prop is provided', () => {
        render(
            <ModalShell
                isOpen={true}
                onClose={vi.fn()}
                title="Default Title"
                titleId="test-id"
                header={<div data-testid="custom-header">Custom Header</div>}
            >
                <div>Content</div>
            </ModalShell>
        );
        expect(screen.getByTestId('custom-header')).toBeInTheDocument();
        expect(screen.queryByText('Default Title')).not.toBeInTheDocument();
    });

    it('renders footer when footer prop is provided', () => {
        render(
            <ModalShell
                isOpen={true}
                onClose={vi.fn()}
                title="Test"
                titleId="test-id"
                footer={<button>Save</button>}
            >
                <div>Content</div>
            </ModalShell>
        );
        expect(screen.getByText('Save')).toBeInTheDocument();
    });
});
