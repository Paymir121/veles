/** Normalize media URLs to same-origin relative paths (/media/...).

Works in production (nginx serves /media/ on the same host) and in dev
(Vite proxy). Absolute URLs from the API — including stale hosts/IPs —
are reduced to the path so photos load on mobile browsers too.
*/
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/')) return url;

  const normalizePath = (pathname: string, search = '') =>
    pathname.startsWith('/media/') ? `${pathname}${search}` : null;

  if (url.startsWith('//')) {
    try {
      return normalizePath(new URL(`https:${url}`).pathname, new URL(`https:${url}`).search);
    } catch {
      return url;
    }
  }

  try {
    const parsed = new URL(url);
    const relative = normalizePath(parsed.pathname, parsed.search);
    if (relative) return relative;
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    return url;
  }
}
