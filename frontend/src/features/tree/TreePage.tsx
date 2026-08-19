import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { findWidestRootId, formatFullName } from './familyChartAdapter';
import { groupTreePeople } from './treePeople';
import { useTree } from './hooks';
import { PeoplePanel } from './PeoplePanel';
import { TreeView } from './TreeView';

export function TreePage() {
  const { data } = useTree();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickedId, setPickedId] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const groups = useMemo(() => (data ? groupTreePeople(data) : []), [data]);
  const defaultCenterId = useMemo(() => (data ? (findWidestRootId(data) ?? '') : ''), [data]);
  const requestedId = searchParams.get('person') ?? '';

  // Derived, not stored: whoever was picked in the panel wins, otherwise
  // /tree?person=42 ("Показать в дереве" on a person's page), otherwise the
  // widest bloodline. Ids that aren't in the current data are ignored, so a
  // stale link or a deleted person can't leave the tree centred on nothing.
  const isInTree = (id: string) => Boolean(id) && Boolean(data?.some((node) => node.id === id));
  const centeredId = isInTree(pickedId)
    ? pickedId
    : isInTree(requestedId)
      ? requestedId
      : defaultCenterId;

  const centeredName = useMemo(() => {
    const node = data?.find((person) => person.id === centeredId);
    return node ? formatFullName(node.data) : '';
  }, [data, centeredId]);

  function handleSelect(personId: string) {
    setPickedId(personId);
    // Drop ?person= once the user navigates on their own, so the URL stops
    // claiming a centre that is no longer what's shown.
    if (requestedId) setSearchParams({}, { replace: true });
    setIsPanelOpen(false);
  }

  return (
    <div className="tree-page">
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          className="btn btn-secondary text-sm md:hidden"
          aria-expanded={isPanelOpen}
          onClick={() => setIsPanelOpen((open) => !open)}
        >
          {isPanelOpen ? 'Скрыть список' : 'Люди'}
        </button>
        {centeredName && (
          <p className="text-sm text-text-muted truncate">
            В центре: <span className="text-text font-medium">{centeredName}</span>
          </p>
        )}
        <p className="hidden lg:block text-xs text-text-muted ml-auto shrink-0">
          Клик по карточке — профиль человека
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
        <PeoplePanel
          groups={groups}
          centeredId={centeredId}
          onSelect={handleSelect}
          className={`${isPanelOpen ? 'flex' : 'hidden'} md:flex max-h-[45vh] md:max-h-none`}
        />
        <TreeView centeredId={centeredId} />
      </div>
    </div>
  );
}
