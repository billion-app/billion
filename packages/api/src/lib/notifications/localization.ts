import { candidateTranslationId } from "../candidate-translation";
import { applySegments, collectSegments } from "../content-translation";
import { getSegmentTranslationsMany } from "../content-translation-store";
import { localDecisionAlertCopy, testAlertCopy } from "./copy";

const localBodies = {
  outcome: {
    es: "Se publicó o actualizó un resultado oficial. Abre para ver los detalles.",
    zh: "官方结果已发布或更新。打开查看详情。",
  },
  cancelled: {
    es: "Se canceló una reunión programada. Abre para ver los detalles.",
    zh: "已安排的会议已取消。打开查看详情。",
  },
  schedule: {
    es: "Cambió el calendario de reuniones. Abre para ver los detalles.",
    zh: "会议日程已更改。打开查看详情。",
  },
};

function localHistoryBody(body: string, language: "es" | "zh") {
  for (const change of ["outcome", "cancelled", "schedule"] as const) {
    if (body === localDecisionAlertCopy({ id: "", title: "" }, change).body)
      return localBodies[change][language];
  }
  return null;
}

function isLocalAlert(row: { kind: string; href?: string }) {
  return (
    row.kind === "follow" && row.href?.startsWith("/local-decision-detail?")
  );
}

export async function localizeAlertHistory<
  T extends {
    id: string;
    title: string;
    body: string;
    kind: string;
    href?: string;
  },
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
        .filter((row) => row.kind !== "test" && !isLocalAlert(row))
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
      if (isLocalAlert(row)) {
        const body = localHistoryBody(row.body, language);
        return {
          ...row,
          body: body ?? row.body,
          translationState: body
            ? ("translated" as const)
            : ("original" as const),
        };
      }
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
