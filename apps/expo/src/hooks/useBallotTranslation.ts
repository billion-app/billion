import { useQuery } from "@tanstack/react-query";

import { trpc } from "~/utils/api";
import {
  ballotDisplayText,
  matchesBallotIdentity,
} from "~/utils/ballot-translation";
import { useLanguage } from "./useLanguage";

/** The server validates the signed, canonical snapshot; the client cannot submit prose. */
export function useBallotTranslation(
  reference: string | undefined,
  identity: {
    kind: "measure" | "contest";
    title: string;
    candidates: string[];
  },
) {
  const { language } = useLanguage();
  const query = useQuery({
    ...trpc.civic.getBallotTranslation.queryOptions({
      reference: reference ?? "",
      language: language === "en" ? "zh" : language,
    }),
    enabled: language !== "en" && !!reference,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 3_000 : false,
  });
  const mismatched =
    query.data?.status === "translated" &&
    !matchesBallotIdentity(query.data.identity, identity);
  const translations =
    language !== "en" && !mismatched && query.data?.status === "translated"
      ? query.data.translations
      : undefined;
  function text(field: string, original: string): string;
  function text(
    field: string,
    original: string | undefined,
  ): string | undefined;
  function text(field: string, original: string | undefined) {
    return ballotDisplayText(
      original,
      `ballot.${field}`,
      translations && query.data?.status === "translated"
        ? query.data
        : undefined,
    );
  }
  return {
    text,
    translationState:
      language === "en" || !reference
        ? ("original" as const)
        : query.isError || mismatched
          ? ("unavailable" as const)
          : query.data?.status === "expired"
            ? ("unavailable" as const)
            : translations
              ? ("translated" as const)
              : ("pending" as const),
    expired: query.data?.status === "expired" || mismatched,
    retry: () => void query.refetch(),
  };
}
