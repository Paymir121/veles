import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { formatFullName } from './familyChartAdapter';
import { groupTreePeople } from './treePeople';
import { useTree } from './hooks';
import { PeoplePanel } from './PeoplePanel';
import { TreeView } from './TreeView';

export function TreePage() {
  const { data } = useTree();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickedId, setPickedId] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const linkedPersonId = useAuthStore((state) => state.user?.linked_person_id);

  const groups = useMemo(() => (data ? groupTreePeople(data) : []), [data]);
  const requestedId = searchParams.get('person') ?? '';

  const focusPersonId = pickedId || requestedId || (linkedPersonId ? String(linkedPersonId) : '') || undefined;

  const focusedName = useMemo(() => {
    if (!focusPersonId || !data) return '';
    const node = data.find((p) => p.id === focusPersonId);
    return node ? formatFullName(node.data) : '';
  }, [data, focusPersonId]);

  function handleSelect(personId: string) {
    setPickedId(personId);
    if (requestedId) setSearchParams({}, { replace: true });
    setIsPanelOpen(false);
  }

  return (
    <div className="tree-page">
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          className="btn btn-secondary text-sm sticky-panel-toggle"
          aria-expanded={isPanelOpen}
          onClick={() => setIsPanelOpen((open) => !open)}
        >
          {isPanelOpen ? 'Скрыть людей' : 'Люди'}
        </button>
        {focusedName && (
          <p className="text-sm text-text-muted truncate">
            В центре: <span className="text-text font-medium">{focusedName}</span>
          </p>
        )}
        <p className="hidden lg:block text-xs text-text-muted ml-auto shrink-0">
          Клик по карточке — профиль человека
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
        <PeoplePanel
          groups={groups}
          centeredId={focusPersonId ?? ''}
          onSelect={handleSelect}
          className={`${isPanelOpen ? 'flex' : 'hidden'} max-h-[45vh] md:max-h-none ${isPanelOpen ? 'mobile-people-panel-open' : ''}`}
        />
        <TreeView focusPersonId={focusPersonId} />
      </div>
    </div>
  );
}
