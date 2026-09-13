import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { markHomeLeft, readLastVisit } from "~/utils/visit-store";

/**
 * The previous session's leave time. Written only when the app actually
 * backgrounds so a mid-read of home cannot collapse "while you were away"
 * to now.
 */
export function useLastVisit() {
  const [lastVisitAt, setLastVisitAt] = useState<Date | undefined>();

  useEffect(() => {
    void readLastVisit().then(setLastVisitAt);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") void markHomeLeft();
    });
    return () => subscription.remove();
  }, []);

  return lastVisitAt;
}
