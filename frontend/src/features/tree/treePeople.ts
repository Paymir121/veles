import type { TreeNode } from '@/shared/types';
import { findFamilyIslands, formatFullName, formatLifespan } from './familyChartAdapter';

// Backs the "Люди" panel on the tree page: a flat, filterable list of everyone
// in the graph, which is what lets family-chart's one-bloodline-at-a-time
// window stop being the user's problem (clicking anyone re-centres on them).
//
// Grouping is by CONNECTED COMPONENT (parents + children + spouses), i.e. by
// actually unrelated families - not by "parentless person", which is a detail of
// how family-chart picks a root and meant nothing to anyone reading it. With a
// single family there is exactly one group and the panel shows no headings.

export interface TreePerson {
  id: string;
  name: string;
  lifespan: string;
}

export interface TreePersonGroup {
  id: string;
  label: string;
  people: TreePerson[];
}

function neighboursOf(node: TreeNode): string[] {
  return [...node.rels.parents, ...node.rels.children, ...node.rels.spouses];
}

function compareByName(a: TreePerson, b: TreePerson): number {
  return a.name.localeCompare(b.name, 'ru');
}

export function groupTreePeople(data: TreeNode[]): TreePersonGroup[] {
  const byId = new Map(data.map((node) => [node.id, node]));
  // Parentless people, widest bloodline first - the first one found in a
  // component is the most sensible person to name that component after.
  const islands = findFamilyIslands(data);
  const islandRank = new Map(islands.map((island, index) => [island.id, index]));

  const seen = new Set<string>();
  const groups: TreePersonGroup[] = [];

  for (const node of data) {
    if (seen.has(node.id)) continue;

    const members: TreeNode[] = [];
    const queue = [node.id];
    seen.add(node.id);
    while (queue.length > 0) {
      const current = byId.get(queue.pop() as string);
      if (!current) continue;
      members.push(current);
      for (const neighbourId of neighboursOf(current)) {
        if (seen.has(neighbourId) || !byId.has(neighbourId)) continue;
        seen.add(neighbourId);
        queue.push(neighbourId);
      }
    }

    const rootId = members
      .map((member) => member.id)
      .filter((id) => islandRank.has(id))
      .sort((a, b) => (islandRank.get(a) as number) - (islandRank.get(b) as number))[0];
    const labelSource = byId.get(rootId ?? members[0].id) ?? members[0];

    groups.push({
      id: labelSource.id,
      label: formatFullName(labelSource.data),
      people: members
        .map((member) => ({
          id: member.id,
          name: formatFullName(member.data),
          lifespan: formatLifespan(member.data),
        }))
        .sort(compareByName),
    });
  }

  groups.sort((a, b) => {
    if (b.people.length !== a.people.length) return b.people.length - a.people.length;
    return a.label.localeCompare(b.label, 'ru');
  });
  return groups;
}

// Same normalisation as the backend search (lowercase + ё/е folded together).
function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е');
}

/** Every word of the query has to match somewhere in a person's name or dates,
 *  so "соколов 1921" narrows instead of widening. Empty groups are dropped. */
export function filterTreePeople(groups: TreePersonGroup[], query: string): TreePersonGroup[] {
  const tokens = normalize(query)
    .split(/\s+/)
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return groups;

  return groups
    .map((group) => ({
      ...group,
      people: group.people.filter((person) => {
        const haystack = normalize(`${person.name} ${person.lifespan}`);
        return tokens.every((token) => haystack.includes(token));
      }),
    }))
    .filter((group) => group.people.length > 0);
}

export function countPeople(groups: TreePersonGroup[]): number {
  return groups.reduce((total, group) => total + group.people.length, 0);
}
