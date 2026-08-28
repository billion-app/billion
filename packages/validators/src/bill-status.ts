/**
 * Removes dotted leaders copied from print-form legislative action text.
 *
 * The action date is stored separately, so a status such as
 * `Effective on . . . . .` should be displayed as `Effective on`. Requiring
 * spaced dots preserves genuine trailing ellipses such as `Pending...`.
 */
export function sanitizeBillStatus(value: string): string {
  return value.replace(/\s+(?:\.\s+){2,}\.\s*$/, "").trim();
}
