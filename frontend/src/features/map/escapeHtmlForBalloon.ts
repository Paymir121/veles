// Yandex Maps balloon content is raw HTML rendered outside React, so
// anything derived from user-entered text (person names, place names) must
// be escaped manually here - React's own escaping doesn't apply to it.
export function escapeHtmlForBalloon(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
