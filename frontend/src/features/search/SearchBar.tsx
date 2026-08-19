import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useSearch } from './hooks';
import { SearchResults } from './SearchResults';
import { buildSearchItems, type SearchItem } from './searchItems';
import type { SearchSelection } from './types';

const DEBOUNCE_MS = 250;

interface SearchBarProps {
  onSelect: (selection: SearchSelection) => void;
  placeholder?: string;
}

// Debounced combobox over GET /api/search/, shared by the tree and map pages.
// Search never imports from tree or map - it only emits a selection outward via
// onSelect, and each page decides what that means for itself.
//
// The query deliberately survives a selection: picking the wrong person out of
// several similar names used to mean retyping the whole thing.
export function SearchBar({
  onSelect,
  placeholder = 'Поиск: фамилия, имя, город, год...',
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  // Which result is highlighted, remembered together with the query it belongs
  // to: that way a new query implicitly starts from the top again, without an
  // effect resetting the index after the fact.
  const [active, setActive] = useState({ query: '', index: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, DEBOUNCE_MS);
  const { data, isFetching } = useSearch(debouncedQuery);
  // Between a keystroke and the debounce firing, the list on screen still
  // belongs to the previous query - say so instead of looking finished.
  const isBehind = trimmedQuery !== debouncedQuery;
  const items = useMemo(() => buildSearchItems(data), [data]);
  const activeIndex =
    active.query === debouncedQuery && items.length > 0
      ? Math.min(active.index, items.length - 1)
      : 0;

  function setActiveIndex(index: number) {
    setActive({ query: debouncedQuery, index });
  }

  // Clicking anywhere outside closes the dropdown. Previously this was a
  // setTimeout on the input's blur, which raced with clicks on the results.
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const hasQuery = debouncedQuery.length > 0;
  const isDropdownOpen = isOpen && hasQuery;

  useEffect(() => {
    if (!isDropdownOpen) return;
    const activeOption = document.getElementById(optionId(activeIndex));
    // jsdom doesn't implement scrollIntoView.
    activeOption?.scrollIntoView?.({ block: 'nearest' });
    // optionId is derived from a stable id; re-running on index/open is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, isDropdownOpen]);

  function handleSelect(item: SearchItem) {
    onSelect(item.selection);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      // A type="search" input clears itself on Escape, and that clearing fires
      // onChange, which would immediately reopen the dropdown. Escape only
      // closes the list here; the query stays for editing.
      event.preventDefault();
      setIsOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isDropdownOpen) {
        setIsOpen(true);
        return;
      }
      if (items.length === 0) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((activeIndex + delta + items.length) % items.length);
      return;
    }
    if (event.key === 'Enter' && isDropdownOpen && items[activeIndex]) {
      event.preventDefault();
      handleSelect(items[activeIndex]);
    }
  }

  return (
    <div className="relative w-full sm:max-w-md" ref={rootRef}>
      <input
        ref={inputRef}
        className="input"
        type="search"
        role="combobox"
        aria-label="Поиск по дереву и карте"
        aria-expanded={isDropdownOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          isDropdownOpen && items.length > 0 ? optionId(activeIndex) : undefined
        }
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {isDropdownOpen && (
        <div className="search-bar-dropdown" id={listboxId}>
          <div className="flex items-center justify-between px-2 pb-1 text-xs text-text-muted">
            <span>{items.length > 0 ? `Найдено: ${items.length}` : 'Поиск'}</span>
            {(isFetching || isBehind) && <span>обновляем...</span>}
          </div>
          {items.length > 0 ? (
            <SearchResults
              items={items}
              query={debouncedQuery}
              activeIndex={activeIndex}
              optionId={optionId}
              onSelect={handleSelect}
              onHover={setActiveIndex}
            />
          ) : (
            <p className="text-sm text-text-muted px-2 py-1">
              {isFetching || isBehind ? 'Ищем...' : 'Ничего не найдено.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
