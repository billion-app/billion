/**
 * Notification payloads only carry an in-app route. Anything else is ignored
 * so a tap cannot bounce the reader onto an arbitrary URL.
 */

export function hrefFromNotificationData(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const href = (data as { href?: unknown }).href;
  if (typeof href !== "string") return undefined;
  if (!href.startsWith("/") || href.startsWith("//")) return undefined;
  return href;
}
