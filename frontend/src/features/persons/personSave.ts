import type { PersonSubmitFiles } from './api';
import type { PersonFormValues } from './types';

export interface ChildrenConflictError {
  children?: string;
  linked_user?: string;
  children_conflicts?: Array<{
    id: number;
    name: string;
    field: 'father' | 'mother';
    current_parent_id: number;
  }>;
}

export function childrenConflictMessage(error: unknown): string | null {
  const detail = (error as { response?: { data?: ChildrenConflictError } })?.response?.data;
  if (!detail?.children_conflicts || detail.children_conflicts.length === 0) {
    return null;
  }
  const lines = detail.children_conflicts.map((conflict) => `• ${conflict.name}`);
  const field = detail.children_conflicts[0].field === 'father' ? 'отец' : 'мать';
  return `У некоторых выбранных детей уже заполнен ${field}:\n\n${lines.join('\n')}\n\nЗаменить на текущего человека?`;
}

export function savePersonErrorText(error: unknown): string {
  const detail = (error as { response?: { data?: ChildrenConflictError } })?.response?.data;
  return detail?.children || detail?.linked_user || 'Не удалось сохранить. Проверьте введённые данные.';
}

export function withForcedChildren(values: PersonFormValues): PersonFormValues {
  return { ...values, force_children_reassign: true };
}

export type PersonSaveFiles = PersonSubmitFiles;
