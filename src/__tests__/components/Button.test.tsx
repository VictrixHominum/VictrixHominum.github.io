import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders with children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('applies primary variant classes by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button', { name: /primary/i });
    expect(button.className).toContain('bg-primary-500');
    expect(button.className).toContain('text-white');
  });

  it('renders as an anchor when href is provided', () => {
    render(<Button href="https://example.com">Link</Button>);
    const anchor = screen.getByRole('link', { name: /link/i });
    expect(anchor).toBeInTheDocument();
    expect(anchor).toHaveAttribute('href', 'https://example.com');
    expect(anchor.tagName).toBe('A');
  });

  it('shows loading spinner when loading=true', () => {
    render(<Button loading>Submit</Button>);
    const button = screen.getByRole('button', { name: /submit/i });
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('animate-spin');
  });

  it('is disabled when loading=true', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('calls onClick handler', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole('button', { name: /click/i }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['sm', 'px-3 py-1.5 text-sm'],
    ['md', 'px-4 py-2 text-sm'],
    ['lg', 'px-6 py-3 text-base'],
  ] as const)('applies size classes for size="%s"', (size, expectedClasses) => {
    render(<Button size={size}>Sized</Button>);
    const button = screen.getByRole('button', { name: /sized/i });
    for (const cls of expectedClasses.split(' ')) {
      expect(button.className).toContain(cls);
    }
  });

  it.each([
    ['primary', 'bg-primary-500'],
    ['secondary', 'bg-surface-200'],
    ['ghost', 'bg-transparent'],
    ['danger', 'bg-red-600'],
  ] as const)('applies variant classes for variant="%s"', (variant, expectedClass) => {
    render(<Button variant={variant}>Variant</Button>);
    const button = screen.getByRole('button', { name: /variant/i });
    expect(button.className).toContain(expectedClass);
  });
});
