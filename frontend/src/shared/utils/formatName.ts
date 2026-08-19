/**
 * Formats a full name from an object with first_name, last_name, and optional
 * patronymic. Accepts any object shape that has these fields (Person,
 * PersonSummary, TreeNodeData, etc.).
 */
export function formatFullName(person: {
  first_name: string;
  last_name: string;
  patronymic?: string;
}): string {
  return (
    [person.last_name, person.first_name, person.patronymic].filter(Boolean).join(' ') ||
    'Без имени'
  );
}

/** Short name without patronymic — used in compact UI like tree nodes. */
export function formatShortName(person: {
  first_name: string;
  last_name: string;
}): string {
  return [person.last_name, person.first_name].filter(Boolean).join(' ') || 'Без имени';
}
