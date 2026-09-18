/**
 * When the in-app OTA restart prompt may appear.
 *
 * Expo's `isUpdatePending` can stay true for the bundle that is already
 * running, and it can be true without a downloaded manifest. The prompt copy
 * says an update is ready to install, so require a distinct downloaded update.
 */

export const DEV_PREVIEW_UPDATE_ID = "dev-preview";
export const ROLLBACK_UPDATE_ID = "rollback";

export type DownloadedUpdateLike = {
  type?: string;
  updateId?: string;
} | null;

export interface UpdatePromptDecisionInput {
  forcePreview: boolean;
  updatesEnabled: boolean;
  isUpdatePending: boolean;
  currentlyRunningUpdateId?: string;
  downloadedUpdate?: DownloadedUpdateLike;
  dismissedUpdateId: string | null;
}

export interface UpdatePromptDecision {
  visible: boolean;
  updateId: string | null;
}

export function shouldForceShowBanner(options: {
  forceShowProp?: boolean;
  isDev: boolean;
  forceEnv?: string;
}): boolean {
  if (options.forceShowProp) return true;
  if (!options.isDev) return false;
  return options.forceEnv === "1";
}

export function resolveUpdatePrompt(
  input: UpdatePromptDecisionInput,
): UpdatePromptDecision {
  if (input.forcePreview) {
    const updateId = DEV_PREVIEW_UPDATE_ID;
    return {
      updateId,
      visible: input.dismissedUpdateId !== updateId,
    };
  }

  const updateId = pendingInstallUpdateId(input);
  if (updateId == null) {
    return { visible: false, updateId: null };
  }

  return {
    updateId,
    visible: input.dismissedUpdateId !== updateId,
  };
}

function pendingInstallUpdateId(
  input: UpdatePromptDecisionInput,
): string | null {
  if (!input.updatesEnabled || !input.isUpdatePending) return null;

  const downloaded = input.downloadedUpdate;
  if (!downloaded) return null;

  if (downloaded.type === "rollback") return ROLLBACK_UPDATE_ID;

  const downloadedId = downloaded.updateId?.trim();
  if (!downloadedId) return null;
  if (downloadedId === input.currentlyRunningUpdateId) return null;

  return downloadedId;
}
