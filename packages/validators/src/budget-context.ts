import { z } from "zod/v4";

const short = z.string().trim().min(1).max(500);
const presentation = short.refine(
  (text) => contextMoneyMentions(text).length === 0,
  "Put monetary amounts in nominal, not presentation labels.",
);
const citation = z.object({
  sourceId: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(100),
  locator: presentation,
});
const scope = z.object({
  period: presentation,
  jurisdiction: presentation,
  timing: z.enum(["annual", "one-time", "stock"]),
  accounting: z.enum(["gross", "net", "unspecified"]),
});
export const contextMoneySchema = z
  .object({
    nominal: short,
    currency: z.literal("USD"),
    scope,
    comparison: z.discriminatedUnion("state", [
      z.object({
        state: z.literal("available"),
        numerator: z.object({
          min: z.number(),
          max: z.number(),
        }),
        denominator: z.object({
          name: presentation,
          amount: z.number().positive(),
          currency: z.literal("USD"),
          scope,
          evidence: z.array(citation).min(1).max(8),
        }),
        basis: z.enum(["measured", "projection", "illustrative"]),
      }),
      z.object({
        state: z.enum(["unavailable", "inapplicable"]),
        reason: presentation,
      }),
    ]),
  })
  .superRefine((value, ctx) => {
    const mentions = contextMoneyMentions(value.nominal);
    if (
      mentions.length !== 1 ||
      mentions[0]?.trim().toLowerCase() !== value.nominal.trim().toLowerCase()
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Nominal must be a complete recognized currency amount or monetary range.",
      });
    }
    const comparison = value.comparison;
    if (comparison.state !== "available") return;
    if (value.scope.accounting === "unspecified")
      ctx.addIssue({
        code: "custom",
        message:
          "An available budget share requires a known gross/net accounting basis.",
      });
    const bounds = nominalBounds(value.nominal);
    if (
      bounds?.min !== comparison.numerator.min ||
      bounds.max !== comparison.numerator.max
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Nominal amount and computed-share numerator must agree exactly.",
      });
    if (
      comparison.numerator.max < comparison.numerator.min ||
      JSON.stringify(value.scope) !==
        JSON.stringify(comparison.denominator.scope)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Budget comparisons require ordered ranges and matching period, jurisdiction, timing and accounting.",
      });
    }
  });
/** Shared display parts keep calculation out of every renderer. */
export function contextMoneyPresentation(
  value: z.infer<typeof contextMoneySchema>,
): {
  nominal: string;
  comparison: string;
  scope: string;
  reason?: string;
} {
  const comparison = value.comparison;
  const accounting =
    value.scope.accounting === "unspecified"
      ? "gross/net basis unspecified"
      : `${value.scope.accounting} basis`;
  const scope = `${value.scope.period} · ${value.scope.jurisdiction} · ${value.scope.timing} · ${accounting}`;
  const nominal = `${value.nominal} USD`;
  if (comparison.state !== "available")
    return {
      nominal,
      comparison: `Budget share ${comparison.state}`,
      scope,
      reason: comparison.reason,
    };
  const percent = (amount: number) =>
    new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 }).format(
      (amount / comparison.denominator.amount) * 100,
    );
  const share =
    comparison.numerator.min === comparison.numerator.max
      ? `${percent(comparison.numerator.min)}%`
      : `${percent(comparison.numerator.min)}–${percent(comparison.numerator.max)}%`;
  const amount = comparison.denominator.amount;
  const scale = amount >= 1e9 ? 1e9 : amount >= 1e6 ? 1e6 : 1;
  const unit = scale === 1e9 ? " billion" : scale === 1e6 ? " million" : "";
  const denominator = `$${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 }).format(amount / scale)}${unit} USD`;
  return {
    nominal,
    comparison: `${share} of ${comparison.denominator.name} (${denominator})`,
    scope: `${scope} · ${comparison.basis}`,
  };
}
/** Text-only consumers use the same calculation and complete scope. */
export function contextMoneyLabel(
  value: z.infer<typeof contextMoneySchema>,
): string {
  const parts = contextMoneyPresentation(value);
  return [parts.nominal, parts.comparison, parts.scope, parts.reason]
    .filter(Boolean)
    .join(" · ");
}

export type ContextMoney = z.infer<typeof contextMoneySchema>;

/** Detect explicit currency amounts, including ranges and verbal cost estimates. */
export function contextMoneyMentions(text: string): string[] {
  const amount =
    /(?:(?:up to|at least|less than|more than|about|approximately|roughly|over|under)\s+)?(?:(?:[+-]?\$|USD\s*[+-]?)\s*[+-]?\d[\d.,]*(?:[–-][+-]?\d[\d.,]*)?\s*(?:k|m|b|bn|million|billion|trillion)?\b|\b[+-]?\d[\d.,]*(?:[–-][+-]?\d[\d.,]*)?\s*(?:k|m|b|bn|million|billion|trillion)?\s+(?:(?:US\s+)?dollars|USD|cents)\b|(?:(?:tens|hundreds) of (?:millions|billions|trillions)(?: to low hundreds of millions)?(?: of)?|(?:half a|several|few|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)(?:[ -](?:one|two|three|four|five|six|seven|eight|nine))? (?:million|billion|trillion)) dollars)/gi;
  return [...new Set(text.match(amount) ?? [])];
}

function nominalBounds(nominal: string): { min: number; max: number } | null {
  const text = nominal.replace(/USD/gi, "").replace("$", "").trim();
  const match =
    /^([+-]?\d[\d.,]*)(?:[–-]([+-]?\d[\d.,]*))?\s*(k|m|b|bn|million|billion|trillion)?(?:\s+(?:(?:US\s+)?dollars|USD))?$/i.exec(
      text,
    );
  if (!match) return null;
  const unit = match[3]?.toLowerCase();
  const scale =
    unit === "trillion"
      ? 1e12
      : unit === "b" || unit === "bn" || unit === "billion"
        ? 1e9
        : unit === "m" || unit === "million"
          ? 1e6
          : unit === "k"
            ? 1e3
            : 1;
  const min =
    Math.round(Number(match[1]?.replaceAll(",", "")) * scale * 100) / 100;
  const max =
    Math.round(
      Number((match[2] ?? match[1])?.replaceAll(",", "")) * scale * 100,
    ) / 100;
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}

/** Compare complete currency mentions; a '$5' prefix never covers '$5 billion'. */
export function hasUncoveredContextMoney(
  text: string,
  money: readonly { nominal: string }[],
): boolean {
  return contextMoneyMentions(text).some(
    (mention) =>
      !money.some(
        (item) =>
          item.nominal.trim().toLowerCase() === mention.trim().toLowerCase(),
      ),
  );
}
