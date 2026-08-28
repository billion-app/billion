/**
 * Whether a request came from an Android device.
 *
 * Shared so the Instagram landing page and the mailing-list API agree on who
 * is an Android visitor — they answer the same question ("can this person
 * install the app?") and would otherwise drift into telling one person two
 * different things.
 *
 * Deliberately coarse. It decides only which of two true sentences to show, so
 * a miss costs a slightly-off CTA, never a broken flow.
 */
export function isAndroidUserAgent(userAgent: string | null | undefined) {
  return /android/i.test(userAgent ?? "");
}
