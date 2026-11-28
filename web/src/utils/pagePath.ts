/**
 * Whether the address is on a page: the page itself, or an address under it
 * (the board's /canvas/want/<id> is the board, its panel open — see the
 * extension's useCanvasLink).
 */
export function onPage(pathname: string, page: string | null | undefined): boolean {
  if (!page) return false;
  if (page === '/') return pathname === '/';
  return pathname === page || pathname.startsWith(page.endsWith('/') ? page : page + '/');
}

/** Pages whose address goes on under them while staying the same page. */
const PAGES_WITH_SUBPATHS = ['/canvas'];

/**
 * The page an address is on: the board's /canvas/want/<id> is /canvas (its
 * panel in the address is not another page); any other address is its own.
 */
export function pageOf(pathname: string): string {
  return PAGES_WITH_SUBPATHS.find(p => onPage(pathname, p)) ?? pathname;
}
