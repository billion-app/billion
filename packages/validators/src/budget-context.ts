import { z } from "zod/v4";

const short = z.string().trim().min(1).max(500);
const citation = z.object({
  sourceId: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(100),
  locator: short,
});
const scope = z.object({
  period: short,
  jurisdiction: short,
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
          name: short,
          amount: z.number().positive(),
          currency: z.literal("USD"),
          scope,
          evidence: z.array(citation).min(1).max(8),
        }),
        basis: z.enum(["measured", "projection", "illustrative"]),
      }),
      z.object({
        state: z.enum(["unavailable", "inapplicable"]),
        reason: short,
      }),
    ]),
  })
  .superRefine((value, ctx) => {
    const comparison = value.comparison;
    if (comparison.state !== "available") return;
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
/** Always displays nominal value and budget context together; never ranks importance. */
export function contextMoneyLabel(
  value: z.infer<typeof contextMoneySchema>,
): string {
  const comparison = value.comparison;
  const accounting =
    value.scope.accounting === "unspecified"
      ? "gross/net basis unspecified"
      : `${value.scope.accounting} basis`;
  if (comparison.state !== "available")
    return `${value.nominal} USD (${value.scope.period}; ${value.scope.jurisdiction}; ${value.scope.timing}; ${accounting}) · Budget share ${comparison.state}: ${comparison.reason}`;
  const percent = (amount: number) =>
    new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 }).format(
      (amount / comparison.denominator.amount) * 100,
    );
  const share =
    comparison.numerator.min === comparison.numerator.max
      ? `${percent(comparison.numerator.min)}%`
      : `${percent(comparison.numerator.min)}–${percent(comparison.numerator.max)}%`;
  const amount = comparison.denominator.amount;
  const scale =
    amount >= 1_000_000_000
      ? 1_000_000_000
      : amount >= 1_000_000
        ? 1_000_000
        : 1;
  const unit =
    scale === 1_000_000_000
      ? " billion"
      : scale === 1_000_000
        ? " million"
        : "";
  const denominator = `$${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 }).format(amount / scale)}${unit} USD`;
  return `${value.nominal} USD · ${share} of ${comparison.denominator.name} (${denominator}; ${value.scope.period}; ${value.scope.jurisdiction}; ${value.scope.timing}; ${accounting}; ${comparison.basis}).`;
}

export type ContextMoney = z.infer<typeof contextMoneySchema>;

/** Detect explicit currency amounts, including ranges and verbal cost estimates. */
export function contextMoneyMentions(text: string): string[] {
  const amount =
    /(?:(?:[+-]?\$|USD\s*[+-]?)\s*[+-]?\d[\d.,]*(?:[–-][+-]?\d[\d.,]*)?\s*(?:k|m|bn|million|billion|trillion)?\b|\b[+-]?\d[\d.,]*(?:[–-][+-]?\d[\d.,]*)?\s*(?:k|m|bn|million|billion|trillion)?\s+(?:US\s+)?dollars\b|(?:tens|hundreds) of (?:millions|billions|trillions)(?: to low hundreds of millions)?(?: of)? dollars)/gi;
  return [...new Set(text.match(amount) ?? [])];
}
