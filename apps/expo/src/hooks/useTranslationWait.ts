import { useCallback, useEffect, useState } from "react";

/** Long queues stop automatic polling; Retry starts a fresh waiting period. */
export function useTranslationWait(key: string | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [expiredKey, setExpiredKey] = useState<string | null>(null);
  const token = key ? `${key}:${attempt}` : null;
  if (!token && expiredKey !== null) setExpiredKey(null);
  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => setExpiredKey(token), 120_000);
    return () => clearTimeout(timer);
  }, [token]);
  return {
    expired: token !== null && expiredKey === token,
    retry: useCallback(() => setAttempt((value) => value + 1), []),
  };
}
