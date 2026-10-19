import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { queryClient, trpc } from "~/utils/api";
import { translationCachePolicy } from "~/utils/translation-cache";
import { useLanguage } from "./useLanguage";
import { useTranslationWait } from "./useTranslationWait";

export function useMeasureTranslation(
  number: string | undefined,
  revision?: string,
  scope: "title" | "reader" = "reader",
) {
  const { language } = useLanguage();
  const options = trpc.civic.getMeasureTranslation.queryOptions({
    number: number ?? "0",
    language: language === "en" ? "zh" : language,
    scope,
    revision,
  });
  const cached = queryClient.getQueryData(options.queryKey);
  const cachedReady =
    cached?.status === "translated" && cached.language === language;
  const wait = useTranslationWait(
    number && language !== "en" && !cachedReady
      ? `${number}:${language}:${revision ?? scope}`
      : undefined,
  );
  const query = useQuery({
    ...options,
    ...translationCachePolicy,
    refetchInterval: wait.expired
      ? false
      : (query) =>
          query.state.data?.status === "unavailable"
            ? false
            : translationCachePolicy.refetchInterval(query),
    // The guide can change independently of a graph revision.
    staleTime: 30_000,
    enabled: !!number && language !== "en" && !wait.expired,
  });
  useEffect(() => {
    if (query.data?.status !== "stale") return;
    void queryClient.invalidateQueries({
      queryKey: trpc.civic.getTrillion.queryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: trpc.civic.getCaliforniaGuide.queryKey(),
    });
  }, [query.data]);
  const translation =
    language !== "en" &&
    query.data?.status === "translated" &&
    query.data.language === language
      ? query.data
      : null;
  return {
    translation,
    language,
    state:
      language === "en"
        ? ("original" as const)
        : translation
          ? ("translated" as const)
          : query.isError || query.data?.status === "unavailable"
            ? ("unavailable" as const)
            : wait.expired
              ? ("delayed" as const)
              : ("pending" as const),
    retry: () => {
      wait.retry();
      void query.refetch();
    },
  };
}
