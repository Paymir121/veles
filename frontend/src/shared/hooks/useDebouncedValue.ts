import { useEffect, useState } from 'react';

/**
 * Generic debounce hook - not tied to any feature, so it lives in shared/
 * like a small utils module would in a backend project. Used by search
 * (features/search/SearchBar.tsx) and by the burial-place / person pickers
 * inside features/persons/PersonForm.tsx, which must NOT import from each
 * other directly.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
