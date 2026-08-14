import { useCallback, useState } from "react";

import type { ContentJurisdiction } from "~/utils/jurisdiction";
import { preferenceStorage } from "~/utils/client-storage";

const JURISDICTION_KEY = "content_jurisdiction";

export function useContentJurisdiction() {
  const [jurisdiction, setJurisdictionState] = useState<ContentJurisdiction>(
    () => {
      const stored = preferenceStorage.getItem(JURISDICTION_KEY);
      return stored === "ca" || stored === "federal" ? stored : "federal";
    },
  );

  const setJurisdiction = useCallback((next: ContentJurisdiction) => {
    setJurisdictionState(next);
    preferenceStorage.setItem(JURISDICTION_KEY, next);
  }, []);

  return { jurisdiction, setJurisdiction };
}
