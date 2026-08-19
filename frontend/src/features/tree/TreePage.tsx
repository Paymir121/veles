import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { SearchBar } from '@/features/search/SearchBar';
import type { SearchSelection } from '@/features/search/types';
import { findFamilyIslands } from './familyChartAdapter';
import { useTree } from './hooks';
import { TreeView, type TreeViewHandle } from './TreeView';

export function TreePage() {
  const treeViewRef = useRef<TreeViewHandle>(null);
  const { data } = useTree();
  const islands = useMemo(() => (data ? findFamilyIslands(data) : []), [data]);
  const [selectedIslandId, setSelectedIslandId] = useState('');

  useEffect(() => {
    if (islands.length === 0) return;
    if (!islands.some((island) => island.id === selectedIslandId)) {
      setSelectedIslandId(islands[0].id);
    }
  }, [islands, selectedIslandId]);

  function handleSearchSelect(selection: SearchSelection) {
    if (selection.kind === 'person') {
      treeViewRef.current?.focusOnPerson(String(selection.person.id));
      return;
    }
    // A burial place doesn't have its own tree node, but its nested
    // `persons` (already included in the /api/search/ response) do - focus
    // the first person buried there as the closest useful equivalent.
    const firstPerson = selection.burialPlace.persons[0];
    if (firstPerson) {
      treeViewRef.current?.focusOnPerson(String(firstPerson.id));
    }
  }

  function handleIslandChange(event: ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value;
    setSelectedIslandId(id);
    treeViewRef.current?.focusOnPerson(id);
  }

  return (
    <div className="tree-page">
      <div className="page-toolbar">
        <SearchBar onSelect={handleSearchSelect} />
        {islands.length > 1 && (
          <label className="family-island-picker">
            Ветка семьи
            <select value={selectedIslandId} onChange={handleIslandChange}>
              {islands.map((island) => (
                <option key={island.id} value={island.id}>
                  {island.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <TreeView ref={treeViewRef} />
    </div>
  );
}
