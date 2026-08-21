import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { formatFullName } from './familyChartAdapter';
import { groupTreePeople } from './treePeople';
import { useTree } from './hooks';
import { PeoplePanel } from './PeoplePanel';
import { TreeView } from './TreeView';
import { useTreeUiStore } from './treeUiStore';

export function TreePage() {
  const { data } = useTree();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickedId, setPickedId] = useState('');
  const linkedPersonId = useAuthStore((state) => state.user?.linked_person_id);
  const isPanelOpen = useTreeUiStore((state) => state.isPeoplePanelOpen);
  const showPhotos = useTreeUiStore((state) => state.showPhotos);
  const togglePeoplePanel = useTreeUiStore((state) => state.togglePeoplePanel);
  const toggleShowPhotos = useTreeUiStore((state) => state.toggleShowPhotos);
  const setPeoplePanelOpen = useTreeUiStore((state) => state.setPeoplePanelOpen);

  const groups = useMemo(() => (data ? groupTreePeople(data) : []), [data]);
  const requestedId = searchParams.get('person') ?? '';

  const focusPersonId = pickedId || requestedId || (linkedPersonId ? String(linkedPersonId) : '') || undefined;

  const focusedName = useMemo(() => {
    if (!focusPersonId || !data) return '';
    const node = data.find((p) => p.id === focusPersonId);
    return node ? formatFullName(node.data) : '';
  }, [data, focusPersonId]);

  useEffect(() => () => setPeoplePanelOpen(false), [setPeoplePanelOpen]);

  function handleSelect(personId: string) {
    setPickedId(personId);
    if (requestedId) setSearchParams({}, { replace: true });
    setPeoplePanelOpen(false);
  }

  return (
    <div className="tree-page">
      <div className="tree-toolbar mb-3">
        <div className="tree-toolbar-actions">
          <button
            type="button"
            className="btn btn-secondary text-sm sticky-panel-toggle"
            aria-expanded={isPanelOpen}
            onClick={togglePeoplePanel}
          >
            {isPanelOpen ? 'Скрыть людей' : 'Люди'}
          </button>
          <button
            type="button"
            className={`btn text-sm ${showPhotos ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={showPhotos}
            onClick={toggleShowPhotos}
          >
            {showPhotos ? 'Скрыть фото' : 'Показать фото'}
          </button>
        </div>
        {focusedName && (
          <p className="tree-toolbar-focus text-sm text-text-muted truncate">
            В центре: <span className="text-text font-medium">{focusedName}</span>
          </p>
        )}
        <p className="hidden lg:block text-xs text-text-muted shrink-0 tree-toolbar-hint">
          Клик — профиль, перетащите карточку чтобы сдвинуть
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0 min-w-0 w-full">
        <PeoplePanel
          groups={groups}
          centeredId={focusPersonId ?? ''}
          onSelect={handleSelect}
          className={`${isPanelOpen ? 'flex' : 'hidden'} max-h-[45vh] md:max-h-none ${isPanelOpen ? 'mobile-people-panel-open' : ''}`}
        />
        <TreeView focusPersonId={focusPersonId} showPhotos={showPhotos} />
      </div>
    </div>
  );
}
