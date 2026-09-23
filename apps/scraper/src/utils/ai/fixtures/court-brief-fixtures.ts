import { readFileSync } from "node:fs";
import { MockLanguageModelV3 } from "ai/test";

import type { CourtBrief } from "@acme/validators";

import type { CourtBriefInput } from "../court-brief.js";

export const emergency: CourtBriefInput = {
  contentHash: "a".repeat(64),
  data: {
    caseNumber: "26A305",
    title: "Postal Service v. California",
    court: "Supreme Court of the United States",
    filedDate: new Date("2026-09-14"),
    status: "Published order opinion",
    url: "https://www.supremecourt.gov/opinions/25pdf/26a305_4g15.pdf",
    fullText: readFileSync(new URL("./26a305.txt", import.meta.url), "utf8"),
  },
};
export const point = (text: string, documentId = "document-1") => ({
  text,
  documentIds: [documentId],
  quote: null,
});
export const emergencyOutput: CourtBrief = {
  takeaway: point(
    "The Court refused to pause a lower-court order, so that order stays in effect for now.",
  ),
  action: {
    ...point("The government's request to pause the injunction was denied."),
    quote: {
      text: "and by her referred to the Court is denied.",
      documentId: "document-1",
      locator: "Order, page 1",
    },
  },
  posture:
    "The Court considered an application for a stay of a preliminary injunction, rather than a final decision on every merits issue.",
  questions: [
    point("Should the injunction be paused while the challenge continues?"),
  ],
  reasoning: [
    {
      ...point(
        "The Court said the government was unlikely to succeed and had not met the requirements for pausing the order.",
      ),
      kind: "court_reasoning",
    },
  ],
  effects: [
    {
      ...point("The challenged injunction remains in place at this stage."),
      group: "Parties subject to the injunction",
      certainty: "court_order",
    },
  ],
  opinions: [
    {
      ...point(
        "Kavanaugh concurred in the stay denial, citing the time election officials would need to implement the rule.",
      ),
      kind: "concurrence",
      author: "Brett Kavanaugh",
    },
    {
      ...point(
        "Alito dissented from the denial and argued the government had made the showing needed for a stay.",
      ),
      kind: "dissent",
      author: "Samuel Alito",
    },
  ],
  unknowns: [
    "This temporary ruling does not finally resolve every question about the Postal Service's statutory authority.",
  ],
  terms: [
    {
      term: "stay",
      plain:
        "A temporary pause. Here, the government asked the Court to pause a lower court's order while the case continues.",
    },
    {
      term: "injunction",
      plain:
        "A court order that requires someone to do something or stop doing something.",
    },
    {
      term: "preliminary injunction",
      plain:
        "A temporary court order that applies while a lawsuit is still being decided.",
    },
    {
      term: "merits",
      plain:
        "The underlying legal questions in the case, rather than a temporary request about what happens while it continues.",
    },
    {
      term: "concurred",
      plain:
        "Agreed with the Court's result, sometimes for different or additional reasons.",
    },
    {
      term: "dissented",
      plain: "Disagreed with the Court's result.",
    },
    {
      term: "statutory authority",
      plain: "Legal power granted by a law passed by the legislature.",
    },
  ],
};

// Synthetic records isolate schema behavior; these are not real reported decisions.
export const merits: CourtBriefInput = {
  contentHash: "b".repeat(64),
  data: {
    ...emergency.data,
    caseNumber: "TEST-24-101",
    title: "Synthetic merits fixture",
    status: "Published merits opinion",
    url: "https://example.org/merits.pdf",
    fullText:
      "The judgment of the Court of Appeals is reversed. The statute requires notice before the agency terminates benefits. We do not decide the amount of benefits owed.",
  },
};
export const meritsOutput: CourtBrief = {
  ...emergencyOutput,
  takeaway: point(
    "The Court reversed the judgment because the statute requires notice before benefits end.",
  ),
  action: {
    ...point("The judgment was reversed."),
    quote: {
      text: "The judgment of the Court of Appeals is reversed.",
      documentId: "document-1",
      locator: null,
    },
  },
  posture: "Review of an appellate judgment on the notice requirement.",
  questions: [],
  reasoning: [
    {
      ...point("The statute requires notice before benefits are terminated."),
      kind: "holding",
    },
  ],
  effects: [],
  opinions: [],
  unknowns: ["The Court did not decide the amount of benefits owed."],
  terms: [],
};
export const separate: CourtBriefInput = {
  ...merits,
  data: {
    ...merits.data,
    fullText: `Source: https://example.org/merits.pdf\n\n${merits.data.fullText}\n\nSource: https://example.org/concurrence.pdf\n\nJUSTICE A, concurring. I agree with the judgment but would use a narrower statutory ground.\n\nSource: https://example.org/dissent.pdf\n\nJUSTICE B, dissenting. I would affirm the judgment because the notice was sufficient.`,
  },
};
export const separateOutput: CourtBrief = {
  ...meritsOutput,
  opinions: [
    {
      ...point(
        "Justice A agreed with the judgment on a narrower statutory ground.",
        "document-2",
      ),
      kind: "concurrence",
      author: "Justice A",
      quote: {
        text: "I agree with the judgment but would use a narrower statutory ground.",
        documentId: "document-2",
        locator: null,
      },
    },
    {
      ...point(
        "Justice B would have affirmed because the notice was sufficient.",
        "document-3",
      ),
      kind: "dissent",
      author: "Justice B",
      quote: {
        text: "I would affirm the judgment because the notice was sufficient.",
        documentId: "document-3",
        locator: null,
      },
    },
  ],
};

export function fixtureModel(outputs: unknown[]) {
  let index = 0;
  return new MockLanguageModelV3({
    provider: "fixture",
    modelId: "court-brief-test",
    doGenerate: async () => ({
      content: [
        { type: "text" as const, text: JSON.stringify(outputs[index++]) },
      ],
      finishReason: { unified: "stop" as const, raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    }),
  });
}
