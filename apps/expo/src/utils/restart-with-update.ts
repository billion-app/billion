interface UpdateInstaller {
  fetchUpdateAsync(): Promise<{
    isNew: boolean;
    isRollBackToEmbedded: boolean;
  }>;
  reloadAsync(): Promise<void>;
}

export const UPDATE_PREPARE_TIMEOUT_MS = 30_000;

function cancellationError() {
  const error = new Error("Update restart cancelled");
  error.name = "AbortError";
  return error;
}

/** Dismissing cancels the restart intent; Expo may finish caching the download. */
export async function restartWithLatestUpdate(
  updates: UpdateInstaller,
  signal?: AbortSignal,
) {
  if (signal?.aborted) throw cancellationError();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    const cancelled = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error("Update download timed out")),
        UPDATE_PREPARE_TIMEOUT_MS,
      );
      abort = () => reject(cancellationError());
      signal?.addEventListener("abort", abort, { once: true });
    });
    // A ready prompt can outlive its download; fetch the channel's latest first.
    const update = await Promise.race([updates.fetchUpdateAsync(), cancelled]);
    if (signal?.aborted) throw cancellationError();
    if (!update.isNew && !update.isRollBackToEmbedded) return;
    await updates.reloadAsync();
  } finally {
    clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
  }
}
