export interface TabVisibilityInput {
  routeName: string;
  isDev: boolean;
  href?: unknown;
  itemDisplay?: string;
}

export function isTabRouteHidden({
  routeName,
  isDev,
  href,
  itemDisplay,
}: TabVisibilityInput): boolean {
  if (!isDev && routeName === "settings") return true;
  return href === null || itemDisplay === "none";
}
