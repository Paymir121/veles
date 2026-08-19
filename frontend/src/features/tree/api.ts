import { apiClient } from '@/shared/api/client';
import type { TreeNode } from '@/shared/types';

// GET /api/tree/ is explicitly documented as unpaginated - it returns the
// raw array in exactly the shape family-chart expects, no client-side
// reshaping needed (see familyChartAdapter.ts, the one place that touches
// family-chart's actual API).
export async function fetchTree(): Promise<TreeNode[]> {
  const { data } = await apiClient.get<TreeNode[]>('/tree/');
  return data;
}
