export function missouriRefreshExpiresAt(
  now: Date,
  intervalMs = 30 * 60 * 1000,
): Date {
  return new Date(now.valueOf() + intervalMs);
}
