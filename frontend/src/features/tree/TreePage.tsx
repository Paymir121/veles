import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { PersonEditDialog } from '@/features/persons/PersonEditDialog';
import { SearchBar } from '@/features/search/SearchBar';
import type { SearchSelection } from '@/features/search/types';
import { formatFullName } from './familyChartAdapter';
import { groupTreePeople } from './treePeople';
import { useTree } from './hooks';
import { PeoplePanel } from './PeoplePanel';
import { TreeView } from './TreeView';
import { useTreeUiStore } from './treeUiStore';

export function TreePage() {
  const { data } = useTree();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [pickedId, setPickedId] = useState('');
  const [searchNotice, setSearchNotice] = useState('');
  const [editingPersonId, setEditingPersonId] = useState<number | null>(null);
  const linkedPersonId = useAuthStore((state) => state.user?.linked_person_id);
  const isPanelOpen = useTreeUiStore((state) => state.isPeoplePanelOpen);
  const showPhotos = useTreeUiStore((state) => state.showPhotos);
  const togglePeoplePanel = useTreeUiStore((state) => state.togglePeoplePanel);
  const toggleShowPhotos = useTreeUiStore((state) => state.toggleShowPhotos);
  const setPeoplePanelOpen = useTreeUiStore((state) => state.setPeoplePanelOpen);

  const groups = useMemo(() => (data ? groupTreePeople(data) : []), [data]);
  const requestedId = searchParams.get('person') ?? '';
  const fallbackId = groups[0]?.id ?? '';

  const focusPersonId =
    pickedId || requestedId || (linkedPersonId ? String(linkedPersonId) : '') || fallbackId || undefined;

  const focusedName = useMemo(() => {
    if (!focusPersonId || !data) return '';
    const node = data.find((p) => p.id === focusPersonId);
    return node ? formatFullName(node.data) : '';
  }, [data, focusPersonId]);

  useEffect(() => () => setPeoplePanelOpen(false), [setPeoplePanelOpen]);

  function handleSelect(personId: string) {
    setPickedId(personId);
    setSearchNotice('');
    if (requestedId) setSearchParams({}, { replace: true });
    setPeoplePanelOpen(false);
  }

  const handleEdit = useCallback((personId: string) => {
    setPickedId(personId);
    setSearchNotice('');
    setPeoplePanelOpen(false);
    setEditingPersonId(Number(personId));
  }, [setPeoplePanelOpen]);

  function handleSearchSelect(selection: SearchSelection) {
    if (selection.kind === 'person') {
      handleSelect(String(selection.person.id));
      return;
    }
    const place = selection.burialPlace;
    if (!Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) {
      setSearchNotice(`У места «${place.name}» не указаны координаты — на карте его нет.`);
      return;
    }
    navigate(`/map?place=${place.id}`);
  }

  return (
    <div className="tree-page">
      <div className="tree-toolbar mb-3">
        <SearchBar onSelect={handleSearchSelect} placeholder="Найти человека..." />
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
        {focusedName && focusPersonId && (
          <Link
            to={`/person/${focusPersonId}`}
            className="tree-toolbar-focus text-sm truncate no-underline"
          >
            Выбран: <span className="text-text font-medium">{focusedName}</span>
            <span className="text-accent"> · Профиль</span>
          </Link>
        )}
        <p className="hidden lg:block text-xs text-text-muted shrink-0 tree-toolbar-hint">
          Клик — выбрать, двойной клик — профиль, перетащите карточку чтобы сдвинуть
        </p>
      </div>

      {searchNotice && (
        <div className="flex items-start gap-3 mb-3 rounded-lg bg-bg-muted px-3 py-2 text-sm">
          <span className="flex-1">{searchNotice}</span>
          <button type="button" className="btn-ghost text-xs" onClick={() => setSearchNotice('')}>
            Скрыть
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0 min-w-0 w-full">
        <PeoplePanel
          groups={groups}
          centeredId={focusPersonId ?? ''}
          onSelect={handleSelect}
          onClose={() => setPeoplePanelOpen(false)}
          className={`${isPanelOpen ? 'flex' : 'hidden'} max-h-[45vh] md:max-h-none ${isPanelOpen ? 'mobile-people-panel-open' : ''}`}
        />
        <TreeView
          focusPersonId={focusPersonId}
          showPhotos={showPhotos}
          onPersonSelect={handleSelect}
          onPersonEdit={handleEdit}
        />
      </div>
      {editingPersonId !== null && (
        <PersonEditDialog
          personId={editingPersonId}
          onClose={() => setEditingPersonId(null)}
        />
      )}
    </div>
  );
}
