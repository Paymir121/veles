// This is the ONE file that touches family-chart's exact init/data API - if
// the library's API ever changes, this is the only file that needs fixing.
//
// Verified against family-chart v0.9.0's own shipped TypeScript declaration
// files (fetched from unpkg.com on 2026-08-18, since the published docs
// site at donatso.github.io/family-chart/ does not expose full method
// signatures and the npm README could not be fetched directly):
//   - dist/types/core/chart.d.ts            -> createChart(), Chart class
//   - dist/types/core/cards/card-html.d.ts  -> CardHtml class
//   - dist/types/types/data.d.ts            -> Datum/Data shape
//   - dist/types/types/treeData.d.ts        -> TreeDatum wraps Datum as `.data`
//
// Key facts confirmed from those files (not guessed):
//   - `createChart` is a named export of the `family-chart` package.
//   - `createChart(container, data): Chart` where `data` is `Datum[]` with
//     the exact {id, data, rels} shape our backend already returns.
//   - `chart.setCardHtml(): CardHtml` switches to the HTML card renderer.
//   - `CardHtml.setCardInnerHtmlCreator((d: TreeDatum) => string): this` is
//     the fully-controlled way to render a card's contents - used here
//     instead of the less-clearly-typed `setCardDisplay()` (its parameter
//     type was declared as `any` in the shipped .d.ts, so its exact accepted
//     shape could not be verified; setCardInnerHtmlCreator's signature was
//     unambiguous, so it's the safer documented-behavior choice).
//   - `CardHtml.setOnCardClick((e: MouseEvent, d: TreeDatum) => void): this`
//     - `d` is a TreeDatum, and TreeDatum.data is the original Datum
//       (id/data/rels), so the person id is at `d.data.id`.
//   - `chart.updateTree(props?): this` (re)renders; `{initial: true}` on
//     first render per the donatso.github.io API summary.
//   - `chart.updateData(data): this` swaps in new data without recreating
//     the chart (used when TanStack Query refetches after a person is
//     edited elsewhere).
//   - `chart.updateMainId(id): this` re-centers the tree on a given person -
//     this is what SearchBar's onSelect uses to "focus" a node (plan
//     requirement: "выбор в поиске фокусирует узел дерева").
//   - `chart.setAncestryDepth(n)` / `chart.setProgenyDepth(n)`: family-chart
//     is a WINDOWED pedigree viewer, not a full-tree renderer by default --
//     internally (layout/calculate-tree.js) both depths default to 1
//     generation each when unset. That default made the tree look broken
//     (most of the family invisible, seemingly with "no connections") once
//     there were more than 3 generations of data, because Chart.createStore
//     never passes these options through. Set generously high here (well
//     beyond any realistic family tree) so the whole connected graph always
//     renders regardless of how many generations get added later.
//   - `chart.setShowSiblingsOfMain(true)`: also show the main person's own
//     siblings (not just ancestors/descendants) -- confirmed real behavior,
//     not just cosmetic, since main_id can land on anyone (see below).
//
// UNVERIFIED: whether `updateMainId` alone re-triggers a re-render or needs
// a follow-up `updateTree()` call - the .d.ts only gives signatures, not
// runtime behavior. Both are called together below to be safe; if that
// turns out to cause a double-render flicker, drop the extra updateTree().
import { createChart } from 'family-chart';
import 'family-chart/styles/family-chart.css';
import type { TreeNode, TreeNodeData } from '@/shared/types';

const MAX_GENERATIONS = 25;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

// Minimal shape of the TreeDatum wrapper we rely on - matches
// dist/types/types/treeData.d.ts (data: Datum) without pulling in the
// library's full (loosely-typed, `[key: string]: any`-heavy) type surface.
interface FamilyChartTreeDatum {
  data: {
    id: string;
    data: TreeNodeData;
  };
}

export function extractPersonId(treeDatum: FamilyChartTreeDatum): string {
  return treeDatum.data.id;
}

export function buildCardInnerHtml(treeDatum: FamilyChartTreeDatum): string {
  const info = treeDatum.data.data;
  const name = escapeHtml(formatFullName(info));
  const lifespan = escapeHtml(formatLifespan(info));
  const avatar = info.avatar
    ? `<img class="f3-card-avatar" src="${escapeHtml(info.avatar)}" alt="" />`
    : '<div class="f3-card-avatar f3-card-avatar-placeholder"></div>';
  // family-chart's own gender-based coloring (--male-color/--female-color)
  // targets a `.card-inner` class that only exists in its built-in card
  // templates -- since setCardInnerHtmlCreator replaces that entirely with
  // this function's output (a differently-named `.f3-card-inner`), that
  // coloring never actually applied. Status is a more useful signal here
  // anyway, so it's coded directly via this class instead (styled in
  // index.css).
  const statusClass =
    info.status === 'deceased' ? 'f3-card-status-deceased' : 'f3-card-status-alive';

  return `
    <div class="f3-card-inner ${statusClass}">
      ${avatar}
      <div class="f3-card-name">${name}</div>
      ${lifespan ? `<div class="f3-card-lifespan">${lifespan}</div>` : ''}
    </div>
  `;
}

// family-chart is a WINDOWED pedigree around one main_id, not a forest
// renderer: setAncestryDepth/setProgenyDepth only walk the MAIN person's
// blood line. A spouse who married in is shown with their partner/children
// at that generation, but their own parents / a second marriage's children
// are not pulled in recursively. Picking such a person as the default
// main_id (they also have no recorded parents) stranded the view on just
// their immediate household -- historically "only the Morozovs".
//
// Default main_id is therefore the parentless person with the most blood
// descendants. That still leaves other bloodlines (disconnected families,
// or a married-in spouse's second family) invisible until main_id changes.
// The library cannot draw those as a forest, so we also expose every
// parentless person as a "family island" the tree page can switch between.
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

export interface FamilyChartHandle {
  updateData: (data: TreeNode[]) => void;
  focusOnPerson: (id: string) => void;
  destroy: () => void;
}

export interface CreateFamilyChartOptions {
  container: HTMLElement;
  data: TreeNode[];
  onCardClick: (personId: string) => void;
  /** Person to centre the initial view on. Falls back to the widest bloodline
   *  when omitted or when the id isn't in the data. */
  mainId?: string;
}

export function createFamilyChart({
  container,
  data,
  onCardClick,
  mainId,
}: CreateFamilyChartOptions): FamilyChartHandle {
  // family-chart's own CSS (imported above) is entirely scoped under a
  // `.f3` selector, and its container-sizing rule specifically needs
  // `.f3.f3-cont` (see dist/styles/family-chart.css) -- the library expects
  // the CALLER to put these classes on the element passed to createChart
  // (its own docs/examples do `<div class="f3 f3-cont">`), it does not add
  // them itself. Without this, none of the library's CSS activates at all:
  // cards render unstyled and the internal <svg> doesn't get its `width:
  // 100%; height: 100%` rule, which is why the tree previously rendered
  // small/cramped instead of filling its container.
  container.classList.add('f3', 'f3-cont');

  // TreeNode and family-chart's Datum are structurally identical (both
  // {id, data, rels}), which is why no reshaping happens here - the
  // backend's /api/tree/ endpoint was built to return exactly this shape.
  // `as any` below is a deliberate, narrow escape hatch: family-chart's own
  // shipped .d.ts types several of these parameters as `any` already (see
  // the verification notes above), so there is no stricter type to satisfy.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chart = createChart(container, data as any);

  chart
    .setCardHtml()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .setCardInnerHtmlCreator(buildCardInnerHtml as any)
    .setOnCardClick(((_event: MouseEvent, treeDatum: FamilyChartTreeDatum) => {
      onCardClick(extractPersonId(treeDatum));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

  chart.setAncestryDepth(MAX_GENERATIONS).setProgenyDepth(MAX_GENERATIONS).setShowSiblingsOfMain(true);

  const rootId =
    mainId && data.some((person) => person.id === mainId) ? mainId : findWidestRootId(data);
  if (rootId) {
    chart.updateMainId(rootId);
  }

  chart.updateTree({ initial: true });

  return {
    updateData: (newData) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chart.updateData(newData as any);
      chart.updateTree();
    },
    focusOnPerson: (id) => {
      chart.updateMainId(id);
      chart.updateTree();
    },
    destroy: () => {
      container.innerHTML = '';
    },
  };
}
