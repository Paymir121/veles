import { apiClient } from '@/shared/api/client';
import type { TreeNode } from '@/shared/types';

export interface TreeGraph {
  nodes: TreeNode[];
}

// GET /api/tree/ is unpaginated: a dict with people already placed on the
// grid (integer x/y cells). This helper unwraps `nodes` for the rest of the UI.
export async function fetchTree(): Promise<TreeNode[]> {
  const { data } = await apiClient.get<TreeGraph>('/tree/', { timeout: 15_000 });
  return data.nodes;
}
