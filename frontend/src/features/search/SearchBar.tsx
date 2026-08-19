import { useState } from 'react';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useSearch } from './hooks';
import { SearchResults } from './SearchResults';
import type { SearchSelection } from './types';

interface SearchBarProps {
  onSelect: (selection: SearchSelection) => void;
  placeholder?: string;
}

export function SearchBar({
  onSelect,
  placeholder = 'Поиск человека или места...',
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data, isFetching } = useSearch(debouncedQuery);

  function handleSelect(selection: SearchSelection) {
    onSelect(selection);
    setIsOpen(false);
    setQuery('');
  }

  return (
    <div className="relative w-full sm:max-w-md">
      <input
        className="input"
        type="search"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
      />
      {isOpen && debouncedQuery.trim() && (
        <div className="search-bar-dropdown">
          {isFetching && <p className="text-sm text-text-muted px-2 py-1">Поиск...</p>}
          {!isFetching && data && (
            <SearchResults
              persons={data.persons}
              burialPlaces={data.burial_places}
              onSelect={handleSelect}
            />
          )}
        </div>
      )}
    </div>
  );
}
