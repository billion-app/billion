import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { relativeActivity } from "~/utils/relative-activity";
import { useLanguage } from "./useLanguage";

const DAY_MS = 86_400_000;

/** Keep a relative legislative date current while its screen remains open. */
export function useRelativeActivity(value: Date | undefined) {
  const { language } = useLanguage();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!value) return;
    const date = value instanceof Date ? value : new Date(value);
    const dateMs = date.getTime();
    if (Number.isNaN(dateMs)) return;

    const elapsedDays = Math.floor(Math.max(0, now - dateMs) / DAY_MS);
    if (elapsedDays >= 30) return;

    const nextBoundary = dateMs + (elapsedDays + 1) * DAY_MS;
    const timeout = setTimeout(
      () => setNow(Date.now()),
      Math.max(1_000, nextBoundary - now + 50),
    );
    return () => clearTimeout(timeout);
  }, [now, value]);

  return relativeActivity(value, now, language);
}
