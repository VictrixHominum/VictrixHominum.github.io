import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { CardProps } from '@/components/ui/Card';

const defaultProps: CardProps = {
  title: 'Test Post Title',
  excerpt: 'This is a test excerpt for the card.',
  date: '2026-01-15',
  tags: ['React', 'TypeScript'],
  slug: 'test-post-title',
  coverImage: undefined,
};

function renderCard(overrides: Partial<CardProps> = {}) {
  return render(
    <MemoryRouter>
      <Card {...defaultProps} {...overrides} />
    </MemoryRouter>,
  );
}

describe('Card', () => {
  it('renders title, excerpt, and date', () => {
    renderCard();
    expect(screen.getByText('Test Post Title')).toBeInTheDocument();
    expect(screen.getByText('This is a test excerpt for the card.')).toBeInTheDocument();
    expect(screen.getByText('Jan 15, 2026')).toBeInTheDocument();
  });

  it('formats date correctly (ISO date -> "MMM d, yyyy")', () => {
    renderCard({ date: '2025-12-03' });
    expect(screen.getByText('Dec 3, 2025')).toBeInTheDocument();
  });

  it('renders tag pills', () => {
    renderCard({ tags: ['React', 'TypeScript', 'Jest'] });
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Jest')).toBeInTheDocument();
  });

  it('links to /blog/{slug}', () => {
    renderCard({ slug: 'my-awesome-post' });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/blog/my-awesome-post');
  });

  it('renders cover image when provided', () => {
    renderCard({ coverImage: '/images/blog/cover.jpg' });
    const img = screen.getByRole('img', { name: /test post title/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/images/blog/cover.jpg');
  });

  it('does not render image when coverImage is not provided', () => {
    renderCard({ coverImage: undefined });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
