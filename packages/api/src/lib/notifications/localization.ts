import { candidateTranslationId } from "../candidate-translation";
import { applySegments, collectSegments } from "../content-translation";
import { getSegmentTranslationsMany } from "../content-translation-store";
import { testAlertCopy } from "./copy";

export async function localizeAlertHistory<
  T extends { id: string; title: string; body: string; kind: string },
>(rows: T[], language: "en" | "es" | "zh") {
  if (language === "en")
    return rows.map((row) => ({
      ...row,
      ...(row.kind === "test"
        ? {
            title: testAlertCopy(language).title,
            body: testAlertCopy(language).body,
          }
        : {}),
      translationState: "original" as const,
    }));
  try {
    const payloads = await getSegmentTranslationsMany(
      rows
        .filter((row) => row.kind !== "test")
        .map((row) => ({
          contentId: candidateTranslationId(`alert:${row.id}`),
          contentType: "notification" as const,
          language,
          segments: collectSegments(row, ["title", "body"], "alert"),
        })),
    );
    let index = 0;
    return rows.map((row) => {
      if (row.kind === "test")
        return {
          ...row,
          title: testAlertCopy(language).title,
          body: testAlertCopy(language).body,
          translationState: "translated" as const,
        };
      const payload = payloads[index++];
      return {
        ...(payload ? applySegments(row, payload, "alert") : row),
        translationState: payload
          ? ("translated" as const)
          : ("pending" as const),
      };
    });
  } catch (error) {
    console.error("Alert history translation unavailable", error);
    return rows.map((row) => ({
      ...row,
      translationState: "unavailable" as const,
    }));
  }
}
