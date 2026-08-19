/** Normalize media URLs to same-origin relative paths (/media/...).

The tree endpoint used to return http://localhost:8000/media/... which works
on the dev PC but breaks on a phone hitting the Vite dev server by LAN IP.
Relative paths go through the Vite/nginx proxy on whatever host the browser uses.
*/
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}
