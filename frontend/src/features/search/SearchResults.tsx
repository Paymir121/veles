import type { BurialPlace, Person } from '@/shared/types';
import type { SearchSelection } from './types';

interface SearchResultsProps {
  persons: Person[];
  burialPlaces: BurialPlace[];
  onSelect: (selection: SearchSelection) => void;
}

export function SearchResults({ persons, burialPlaces, onSelect }: SearchResultsProps) {
  if (persons.length === 0 && burialPlaces.length === 0) {
    return <p className="text-sm text-text-muted px-2 py-1">Ничего не найдено.</p>;
  }

  return (
    <div>
      {persons.length > 0 && (
        <div className="search-results-group">
          <h4>Люди</h4>
          <ul>
            {persons.map((person) => (
              <li key={`person-${person.id}`}>
                <button type="button" onClick={() => onSelect({ kind: 'person', person })}>
                  {person.last_name} {person.first_name} {person.patronymic}
                  {person.birth_place && <span className="text-text-muted text-xs ml-1"> · {person.birth_place}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {burialPlaces.length > 0 && (
        <div className="search-results-group">
          <h4>Места захоронения</h4>
          <ul>
            {burialPlaces.map((place) => (
              <li key={`burial-place-${place.id}`}>
                <button
                  type="button"
                  onClick={() => onSelect({ kind: 'burial_place', burialPlace: place })}
                >
                  {place.name} {place.city && <span className="text-text-muted text-xs ml-1">· {place.city}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
