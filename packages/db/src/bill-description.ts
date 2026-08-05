export const BILL_DESCRIPTION_MAX_CHARS = 100;

/** Keep feed/detail descriptions compact even when a model ignores the prompt. */
export function clampBillDescription(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= BILL_DESCRIPTION_MAX_CHARS) return normalized;

  const candidate = normalized.slice(0, BILL_DESCRIPTION_MAX_CHARS - 1);
  const lastSpace = candidate.lastIndexOf(" ");
  const cutoff = lastSpace >= 70 ? lastSpace : candidate.length;

  return `${candidate.slice(0, cutoff).replace(/[\s,;:.!?-]+$/u, "")}…`;
}
