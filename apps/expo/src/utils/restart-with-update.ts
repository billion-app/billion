interface UpdateInstaller {
  fetchUpdateAsync(): Promise<{
    isNew: boolean;
    isRollBackToEmbedded: boolean;
  }>;
  reloadAsync(): Promise<void>;
}

export async function restartWithLatestUpdate(updates: UpdateInstaller) {
  // A ready prompt can outlive its download; fetch the channel's latest first.
  const update = await updates.fetchUpdateAsync();
  if (!update.isNew && !update.isRollBackToEmbedded) return;
  await updates.reloadAsync();
}
