import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../Button';

describe('Button', () => {
    it('renders children text', () => {
        render(<Button>Click me</Button>);
        expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Click</Button>);
        fireEvent.click(screen.getByText('Click'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('applies primary variant by default', () => {
        render(<Button>Default</Button>);
        const btn = screen.getByText('Default');
        expect(btn.className).toContain('btn-primary');
    });

    it('applies secondary variant', () => {
        render(<Button variant="secondary">Secondary</Button>);
        const btn = screen.getByText('Secondary');
        expect(btn.className).toContain('btn-secondary');
    });

    it('applies fullWidth class', () => {
        render(<Button fullWidth>Full</Button>);
        const btn = screen.getByText('Full');
        expect(btn.className).toContain('w-full');
    });

    it('is disabled when disabled prop is set', () => {
        render(<Button disabled>Disabled</Button>);
        expect(screen.getByText('Disabled')).toBeDisabled();
    });

    it('merges custom className', () => {
        render(<Button className="custom-class">Custom</Button>);
        expect(screen.getByText('Custom').className).toContain('custom-class');
    });
});
