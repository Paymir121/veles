import { useMemo, useState } from 'react';
import {
  countPeople,
  filterTreePeople,
  type TreePersonGroup,
} from './treePeople';

interface PeoplePanelProps {
  groups: TreePersonGroup[];
  centeredId: string;
  onSelect: (personId: string) => void;
  className?: string;
}

// One control that replaced the old "Ветка семьи" dropdown: a live-filtered
// list of everyone in the tree. Filtering is client-side over the already
// loaded /api/tree/ data, so it responds on every keystroke without a request,
// and picking someone re-centres the chart on them.
export function PeoplePanel({ groups, centeredId, onSelect, className = '' }: PeoplePanelProps) {
  const [query, setQuery] = useState('');
  const visibleGroups = useMemo(() => filterTreePeople(groups, query), [groups, query]);
  const total = countPeople(groups);
  const shown = countPeople(visibleGroups);
  const showGroupLabels = groups.length > 1;

  return (
    <aside
      className={`flex-col gap-3 w-full md:w-72 shrink-0 border border-border rounded-lg bg-surface p-3 min-h-0 ${className}`}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Люди</h2>
        <span className="text-xs text-text-muted">
          {query.trim() ? `${shown} из ${total}` : total}
        </span>
      </div>

      <input
        className="input"
        type="search"
        aria-label="Фильтр списка людей"
        placeholder="Фамилия, имя, год..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        {visibleGroups.length === 0 ? (
          <p className="text-sm text-text-muted py-2">Никого не найдено.</p>
        ) : (
          visibleGroups.map((group) => (
            <div key={group.id} className="mb-2">
              {showGroupLabels && (
                <div className="px-2 pt-2 pb-1 text-xs uppercase tracking-wide text-text-muted">
                  {group.label} · {group.people.length}
                </div>
              )}
              <ul className="list-none m-0 p-0">
                {group.people.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      className="w-full text-left px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-bg-muted data-[active=true]:bg-accent/15 data-[active=true]:font-medium"
                      data-active={person.id === centeredId}
                      aria-current={person.id === centeredId}
                      onClick={() => onSelect(person.id)}
                    >
                      <span className="block">{person.name}</span>
                      {person.lifespan && (
                        <span className="block text-xs text-text-muted">{person.lifespan}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
