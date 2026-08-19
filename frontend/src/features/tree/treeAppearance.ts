const STORAGE_KEY = 'veles-tree-appearance';

export const DEFAULT_EDGE_STROKE_WIDTH = 2.2;
export const MIN_EDGE_STROKE_WIDTH = 0.5;
export const MAX_EDGE_STROKE_WIDTH = 100;

interface StoredTreeAppearance {
  edgeStrokeWidth?: number;
}

function clampEdgeStrokeWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_EDGE_STROKE_WIDTH;
  const rounded = Math.round(value * 10) / 10;
  return Math.min(MAX_EDGE_STROKE_WIDTH, Math.max(MIN_EDGE_STROKE_WIDTH, rounded));
}

function readStoredAppearance(): StoredTreeAppearance | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredTreeAppearance;
  } catch {
    return null;
  }
}

export function getEdgeStrokeWidth(): number {
  const stored = readStoredAppearance();
  if (typeof stored?.edgeStrokeWidth !== 'number') return DEFAULT_EDGE_STROKE_WIDTH;
  return clampEdgeStrokeWidth(stored.edgeStrokeWidth);
}

export function setEdgeStrokeWidth(value: number): number {
  const next = clampEdgeStrokeWidth(value);
  if (typeof window === 'undefined') return next;
  try {
    const current = readStoredAppearance() ?? {};
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...current, edgeStrokeWidth: next }),
    );
  } catch {
    // Ignore storage failures — the tree still works with the in-memory value.
  }
  return next;
}

/** Scale a layout-default stroke so kinds keep their relative thickness. */
export function scaleEdgeStrokeWidth(baseWidth: number, userWidth: number): number {
  const safeBase = Number.isFinite(baseWidth) && baseWidth > 0
    ? baseWidth
    : DEFAULT_EDGE_STROKE_WIDTH;
  return Math.round((safeBase * (userWidth / DEFAULT_EDGE_STROKE_WIDTH)) * 100) / 100;
}
