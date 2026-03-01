import React from 'react';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with role="status"', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has accessible "Loading..." text (sr-only)', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toHaveClass('sr-only');
  });

  it.each([
    ['sm', 'h-4 w-4 border-2'],
    ['md', 'h-8 w-8'],
    ['lg', 'h-12 w-12 border-4'],
  ] as const)('applies size classes for size="%s"', (size, expectedClasses) => {
    render(<LoadingSpinner size={size} />);
    const statusEl = screen.getByRole('status');
    // The spinning div is the first child of the status container
    const spinnerDiv = statusEl.querySelector('div');
    expect(spinnerDiv).toBeTruthy();
    for (const cls of expectedClasses.split(' ')) {
      expect(spinnerDiv!.className).toContain(cls);
    }
  });
});
