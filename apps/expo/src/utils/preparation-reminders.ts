/** Integration seam for #422. No provider dates are promoted to verified deadlines. */
export interface VerifiedPreparationDeadline {
  electionKey: string;
  id: string;
  revision: string;
  applicable: boolean;
  verified: boolean;
  sourceUrl: string;
  /** Verification validity supplied by the deadline owner, never inferred locally. */
  validUntil: string;
  at: string;
}
export interface PreparationReminderAdapter {
  permission(): Promise<boolean>;
  schedule(id: string, when: Date): Promise<void>;
  cancel(id: string): Promise<void>;
}
export function createPreparationReminders(
  adapter: PreparationReminderAdapter,
) {
  // Caller must persist this identifier and reconcile on launch before enabling
  // production reminders. Content must contain no notes or tentative choices.
  return async function reconcile({
    optedIn,
    electionKey,
    deadline,
    previousId,
    now = new Date(),
  }: {
    optedIn: boolean;
    electionKey: string;
    deadline?: VerifiedPreparationDeadline;
    previousId?: string;
    now?: Date;
  }) {
    const at = deadline ? new Date(deadline.at) : undefined;
    const validUntil = deadline ? new Date(deadline.validUntil) : undefined;
    const valid =
      optedIn &&
      deadline?.verified === true &&
      deadline.applicable === true &&
      deadline.electionKey === electionKey &&
      deadline.sourceUrl.startsWith("https://") &&
      at &&
      Number.isFinite(at.getTime()) &&
      at > now &&
      validUntil &&
      Number.isFinite(validUntil.getTime()) &&
      validUntil > at;
    // Cancel first, including on changed/expired deadlines or opt-out. A failed
    // cancellation aborts instead of claiming notifications are off.
    if (previousId) await adapter.cancel(previousId);
    if (!valid) return { status: "off" as const };
    if (!(await adapter.permission())) return { status: "denied" as const };
    const id = `billion-preparation-${encodeURIComponent(JSON.stringify([electionKey, deadline.id, deadline.revision]))}`;
    await adapter.schedule(id, at);
    return { status: "scheduled" as const, id };
  };
}
