import type { ContextMoney } from "./budget-context";

export type ContextMoneyLanguage = "en" | "es" | "zh";

const moneyLabels = {
  en: {
    annual: "annual",
    "one-time": "one-time",
    stock: "stock",
    gross: "gross basis",
    net: "net basis",
    unspecified: "gross/net basis unspecified",
    measured: "measured",
    projection: "projection",
    illustrative: "illustrative",
    unavailable: "Budget share unavailable",
    inapplicable: "Budget share inapplicable",
  },
  es: {
    annual: "anual",
    "one-time": "una sola vez",
    stock: "saldo acumulado",
    gross: "base bruta",
    net: "base neta",
    unspecified: "base bruta/neta no especificada",
    measured: "medido",
    projection: "proyección",
    illustrative: "ilustrativo",
    unavailable: "Proporción del presupuesto no disponible",
    inapplicable: "Proporción del presupuesto no aplicable",
  },
  zh: {
    annual: "每年",
    "one-time": "一次性",
    stock: "存量",
    gross: "总额口径",
    net: "净额口径",
    unspecified: "未说明总额或净额口径",
    measured: "实测",
    projection: "预测",
    illustrative: "示例",
    unavailable: "预算占比不可用",
    inapplicable: "预算占比不适用",
  },
};

export function contextMoneyPresentation(
  value: ContextMoney,
  language: ContextMoneyLanguage = "en",
): {
  nominal: string;
  comparison: string;
  scope: string;
  reason?: string;
} {
  const comparison = value.comparison;
  const labels = moneyLabels[language];
  const locale = language === "zh" ? "zh-CN" : `${language}-US`;
  const accounting = labels[value.scope.accounting];
  const scope = `${value.display?.period ?? value.scope.period} · ${value.display?.jurisdiction ?? value.scope.jurisdiction} · ${labels[value.scope.timing]} · ${accounting}`;
  const nominal = `${value.display?.nominal ?? value.nominal} USD`;
  if (comparison.state !== "available")
    return {
      nominal,
      comparison: labels[comparison.state],
      scope,
      reason: value.display?.reason ?? comparison.reason,
    };
  const percent = (amount: number) =>
    new Intl.NumberFormat(locale, { maximumSignificantDigits: 3 }).format(
      (amount / comparison.denominator.amount) * 100,
    );
  const share =
    comparison.numerator.min === comparison.numerator.max
      ? `${percent(comparison.numerator.min)}%`
      : `${percent(comparison.numerator.min)}–${percent(comparison.numerator.max)}%`;
  const amount = comparison.denominator.amount;
  const scale = amount >= 1e9 ? 1e9 : amount >= 1e6 ? 1e6 : 1;
  const unit = scale === 1e9 ? " billion" : scale === 1e6 ? " million" : "";
  const denominator =
    language === "en"
      ? `$${new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }).format(amount / scale)}${unit} USD`
      : new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "USD",
          currencyDisplay: "code",
          maximumFractionDigits: 2,
        }).format(amount);
  return {
    nominal,
    comparison:
      language === "zh"
        ? `占${value.display?.denominatorName ?? comparison.denominator.name}（${denominator}）的 ${share}`
        : language === "es"
          ? `${share} de ${value.display?.denominatorName ?? comparison.denominator.name} (${denominator})`
          : `${share} of ${value.display?.denominatorName ?? comparison.denominator.name} (${denominator})`,
    scope: `${scope} · ${labels[comparison.basis]}`,
  };
}
/** Text-only consumers use the same calculation and complete scope. */
export function contextMoneyLabel(
  value: ContextMoney,
  language: ContextMoneyLanguage = "en",
): string {
  const parts = contextMoneyPresentation(value, language);
  return [parts.nominal, parts.comparison, parts.scope, parts.reason]
    .filter(Boolean)
    .join(" · ");
}
