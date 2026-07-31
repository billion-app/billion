import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import * as Updates from "expo-updates";

async function restartWithUpdate() {
  try {
    await Updates.reloadAsync();
  } catch (error) {
    console.warn("Unable to restart with the downloaded update:", error);
    Alert.alert(
      "Unable to restart",
      "Close and reopen Billion to finish installing the update.",
    );
  }
}

export function UpdatePrompt() {
  const { downloadedUpdate, isUpdatePending } = Updates.useUpdates();
  const promptedUpdateId = useRef<string | null>(null);

  useEffect(() => {
    if (!isUpdatePending) return;

    const updateId = downloadedUpdate?.updateId ?? "pending";
    if (promptedUpdateId.current === updateId) return;
    promptedUpdateId.current = updateId;

    Alert.alert(
      "A new version is available",
      "Restart Billion to get the latest improvements.",
      [
        { text: "Later", style: "cancel" },
        {
          text: "Restart now",
          onPress: () => void restartWithUpdate(),
        },
      ],
    );
  }, [downloadedUpdate?.updateId, isUpdatePending]);

  return null;
}
