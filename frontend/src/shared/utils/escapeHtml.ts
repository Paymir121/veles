/**
 * Escapes HTML special characters. Used for any user-entered text rendered as
 * raw HTML outside React (Yandex Maps balloon content, hint content, etc.).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
