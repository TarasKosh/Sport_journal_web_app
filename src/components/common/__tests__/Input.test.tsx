import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Input } from '../Input';

describe('Input', () => {
    it('renders input element', () => {
        render(<Input />);
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders label when provided', () => {
        render(<Input label="Username" />);
        expect(screen.getByText('Username')).toBeInTheDocument();
    });

    it('shows error message when error prop is set', () => {
        render(<Input error="Required field" />);
        expect(screen.getByText('Required field')).toBeInTheDocument();
    });

    it('calls onChange when typing', () => {
        const onChange = vi.fn();
        render(<Input onChange={onChange} />);
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'test' } });
        expect(onChange).toHaveBeenCalled();
    });

    it('forwards placeholder', () => {
        render(<Input placeholder="Enter text" />);
        expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('applies error style when error exists', () => {
        render(<Input error="Error" />);
        const input = screen.getByRole('textbox');
        expect(input.className).toContain('border-danger');
    });
});
