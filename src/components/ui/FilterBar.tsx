import type { ChangeEvent } from 'react';

export type SortOption = 'newest' | 'oldest' | 'a-z' | 'z-a';

export interface FilterBarProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const sortLabels: Record<SortOption, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  'a-z': 'Title A-Z',
  'z-a': 'Title Z-A',
};

export function FilterBar({
  currentSort,
  onSortChange,
  searchQuery,
  onSearchChange,
}: FilterBarProps) {
  function handleSortChange(e: ChangeEvent<HTMLSelectElement>) {
    onSortChange(e.target.value as SortOption);
  }

  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    onSearchChange(e.target.value);
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search posts..."
          aria-label="Search posts"
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-surface-50 border border-surface-300 rounded-lg text-gray-200 placeholder-gray-500 transition-colors duration-150 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
        {searchQuery.length > 0 && (
          <button
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors duration-150"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Sort dropdown */}
      <div className="relative shrink-0">
        <select
          value={currentSort}
          onChange={handleSortChange}
          aria-label="Sort posts"
          className="appearance-none w-full sm:w-auto pl-4 pr-10 py-2.5 text-sm bg-surface-50 border border-surface-300 rounded-lg text-gray-200 transition-colors duration-150 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 cursor-pointer"
        >
          {(Object.keys(sortLabels) as SortOption[]).map((option) => (
            <option key={option} value={option}>
              {sortLabels[option]}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </div>
    </div>
  );
}
