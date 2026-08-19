import { GROUP_LABELS, splitHighlight, type SearchItem } from './searchItems';

interface SearchResultsProps {
  items: SearchItem[];
  query: string;
  activeIndex: number;
  optionId: (index: number) => string;
  onSelect: (item: SearchItem) => void;
  onHover: (index: number) => void;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitHighlight(text, query).map((part, index) =>
        part.match ? (
          <mark key={index} className="bg-accent/20 text-text rounded-sm px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

// Presentational listbox. Both result groups come in as one flat, already
// ordered list (see buildSearchItems) because keyboard navigation has to treat
// them as a single sequence - the group headings are drawn from the items
// themselves rather than by rendering two separate lists.
export function SearchResults({
  items,
  query,
  activeIndex,
  optionId,
  onSelect,
  onHover,
}: SearchResultsProps) {
  return (
    <ul role="listbox" aria-label="Результаты поиска" className="list-none m-0 p-0">
      {items.map((item, index) => {
        const isFirstOfGroup = index === 0 || items[index - 1].group !== item.group;
        return (
          <li key={item.key}>
            {isFirstOfGroup && (
              <div
                role="presentation"
                className="px-2 pt-2 pb-1 text-xs uppercase tracking-wide text-text-muted"
              >
                {GROUP_LABELS[item.group]}
              </div>
            )}
            <div
              role="option"
              id={optionId(index)}
              aria-selected={index === activeIndex}
              data-active={index === activeIndex}
              className="px-2 py-2 rounded-lg cursor-pointer data-[active=true]:bg-bg-muted"
              onMouseEnter={() => onHover(index)}
              // mousedown, not click: the input's blur handler closes the
              // dropdown, and blur fires before click would.
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(item);
              }}
            >
              <div className="text-sm text-text">
                <Highlighted text={item.title} query={query} />
              </div>
              {item.subtitle && (
                <div className="text-xs text-text-muted">
                  <Highlighted text={item.subtitle} query={query} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
