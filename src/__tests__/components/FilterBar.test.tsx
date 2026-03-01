import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from '@/components/ui/FilterBar';
import { SortOption } from '@/components/ui/FilterBar';

describe('FilterBar', () => {
  const defaultProps = {
    currentSort: 'newest' as SortOption,
    onSortChange: jest.fn(),
    searchQuery: '',
    onSearchChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input and sort dropdown', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByRole('textbox', { name: /search posts/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /sort posts/i })).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in search', async () => {
    const onSearchChange = jest.fn();
    const user = userEvent.setup();

    render(<FilterBar {...defaultProps} onSearchChange={onSearchChange} />);
    const input = screen.getByRole('textbox', { name: /search posts/i });

    await user.type(input, 'react');

    expect(onSearchChange).toHaveBeenCalled();
    expect(onSearchChange).toHaveBeenLastCalledWith('t');
  });

  it('calls onSortChange when changing dropdown value', async () => {
    const onSortChange = jest.fn();
    const user = userEvent.setup();

    render(<FilterBar {...defaultProps} onSortChange={onSortChange} />);
    const select = screen.getByRole('combobox', { name: /sort posts/i });

    await user.selectOptions(select, 'oldest');

    expect(onSortChange).toHaveBeenCalledWith('oldest');
  });

  it('shows clear button when search has text', () => {
    render(<FilterBar {...defaultProps} searchQuery="react" />);
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });

  it('clears search when clear button is clicked', async () => {
    const onSearchChange = jest.fn();
    const user = userEvent.setup();

    render(
      <FilterBar
        {...defaultProps}
        searchQuery="react"
        onSearchChange={onSearchChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /clear search/i }));
    expect(onSearchChange).toHaveBeenCalledWith('');
  });
});
