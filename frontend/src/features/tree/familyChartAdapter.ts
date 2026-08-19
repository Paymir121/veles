// Helper functions for tree data: formatting, island discovery, grouping.
// Originally written for family-chart; the library-specific code was removed
// when we switched to @xyflow/react + elkjs, but these pure helpers are still
// used by treePeople.ts and TreePage.tsx.
import type { TreeNode, TreeNodeData } from '@/shared/types';

export function formatFullName(info: TreeNodeData): string {
  return (
    [info.last_name, info.first_name, info.patronymic].filter(Boolean).join(' ') || 'Без имени'
  );
}

export function formatLifespan(info: TreeNodeData): string {
  const birth = info.birth_date || '?';
  if (info.status === 'deceased') {
    return `${birth} – ${info.death_date || '?'}`;
  }
  return birth !== '?' ? birth : '';
}

export interface FamilyIsland {
  id: string;
  label: string;
  descendantCount: number;
}

function countBloodDescendants(
  id: string,
  byId: Map<string, TreeNode>,
  seen: Set<string>,
): number {
  if (seen.has(id)) return 0;
  seen.add(id);
  const person = byId.get(id);
  if (!person) return 0;
  let count = 0;
  for (const childId of person.rels.children) {
    count += 1 + countBloodDescendants(childId, byId, seen);
  }
  return count;
}

export function findFamilyIslands(data: TreeNode[]): FamilyIsland[] {
  const byId = new Map(data.map((person) => [person.id, person]));
  const islands: FamilyIsland[] = [];
  for (const person of data) {
    if (person.rels.parents.length > 0) continue;
    islands.push({
      id: person.id,
      label: formatFullName(person.data),
      descendantCount: countBloodDescendants(person.id, byId, new Set()),
    });
  }
  islands.sort((a, b) => {
    if (b.descendantCount !== a.descendantCount) {
      return b.descendantCount - a.descendantCount;
    }
    return a.label.localeCompare(b.label, 'ru');
  });
  return islands;
}

export function findWidestRootId(data: TreeNode[]): string | undefined {
  return findFamilyIslands(data)[0]?.id;
}
