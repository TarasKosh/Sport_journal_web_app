import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card } from '../Card';

describe('Card', () => {
    it('renders children', () => {
        render(<Card>Card content</Card>);
        expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('applies default variant classes', () => {
        render(<Card>Default</Card>);
        const card = screen.getByText('Default');
        expect(card.className).toContain('bg-bg-secondary');
        expect(card.className).toContain('shadow-sm');
    });

    it('applies outlined variant classes', () => {
        render(<Card variant="outlined">Outlined</Card>);
        const card = screen.getByText('Outlined');
        expect(card.className).toContain('border');
        expect(card.className).toContain('border-border');
    });

    it('merges custom className', () => {
        render(<Card className="custom-class">Custom</Card>);
        expect(screen.getByText('Custom').className).toContain('custom-class');
    });
});
