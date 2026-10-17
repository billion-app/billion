import type { ContextMoney } from "./budget-context";

export function contextMoneyPresentation(value: ContextMoney): {
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
export function contextMoneyLabel(value: ContextMoney): string {
  const parts = contextMoneyPresentation(value);
  return [parts.nominal, parts.comparison, parts.scope, parts.reason]
    .filter(Boolean)
    .join(" · ");
}
