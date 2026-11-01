import type { BillBriefData } from "./BillBrief";
import { getBillDateValue } from "./bill-date-milestones";

type Fact = BillBriefData["facts"][number];
export interface TemperatureFigure {
  kind: "temperature";
  points: [Fact & { amount: number }, Fact & { amount: number }];
  supporting: Fact[];
  unit: "F" | "C";
  min: number;
  max: number;
}
export interface MetricFigure {
  kind: "metrics";
  points: [Fact, ...Fact[]];
}

/** Only a shared, explicit unit earns a scale. Dates and unrelated quantities
 * never become comparable bars; supplied qualifiers stay with every value. */
export function getBillFactFigure(
  facts: readonly Fact[],
): TemperatureFigure | MetricFigure | null {
  const temperatures = facts.flatMap((fact) => {
    const match =
      /^(-?\d+(?:\.\d+)?)\s*°([FC])\s+(?:heat index|índice de calor|热指数)$/iu.exec(
        fact.value.replaceAll("**", "").trim(),
      );
    if (!match || !/(?:propos|拟议|提案)/iu.test(fact.note ?? "")) return [];
    return [
      {
        ...fact,
        amount: Number(match[1]),
        unit: match[2]?.toUpperCase(),
        original: fact,
      },
    ];
  });
  for (const unit of ["F", "C"] as const) {
    const points = temperatures
      .filter((point) => point.unit === unit)
      .sort((a, b) => a.amount - b.amount);
    // More than two thresholds require a different graphic, not silent omission.
    if (points.length !== 2) continue;
    const [first, second] = points;
    if (
      !first ||
      !second ||
      !Number.isFinite(first.amount) ||
      !Number.isFinite(second.amount) ||
      first.amount === second.amount
    )
      continue;
    const padding = (second.amount - first.amount) / 2;
    return {
      kind: "temperature",
      points: [first, second],
      supporting: facts.filter(
        (fact) => fact !== first.original && fact !== second.original,
      ),
      unit,
      min: first.amount - padding,
      max: second.amount + padding,
    };
  }
  const [first, ...rest] = facts;
  return first ? { kind: "metrics", points: [first, ...rest] } : null;
}

/** Separate visual emphasis from meaning: the full suffix stays adjacent to
 * its number, and nonnumeric dates/scopes remain complete text. */
export function getBillFactDisplay(value: string) {
  const supplied = value.replaceAll("**", "").trim();
  // A calendar date is one value, not a large leading day/year plus tiny suffix.
  if (
    /^(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}年|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)))/iu.test(
      supplied,
    )
  ) {
    return { value: supplied, qualifier: "", numeric: false };
  }
  const prefixMatch =
    /^(Every|Within|Up to|At least|At most|Cada|Dentro de|Hasta|Al menos|Como máximo)\s+(?=[$€£¥−-]?\d)/iu.exec(
      supplied,
    );
  const prefix = prefixMatch?.[0].trim();
  const rest = prefixMatch ? supplied.slice(prefixMatch[0].length) : supplied;
  const match = /^([−-]?[$€£¥]?\d[\d,.]*(?:[–-]\d[\d,.]*)?%?)(.*)$/u.exec(rest);
  return match
    ? {
        value: match[1] ?? supplied,
        qualifier: match[2]?.trim() ?? "",
        numeric: true,
        ...(prefix ? { prefix } : {}),
      }
    : { value: supplied, qualifier: "", numeric: false };
}

/** Units identify time and energy facts without inventing a policy category. */
export function getBillFactSymbol(
  value: string,
  label: string,
): "calendar" | "clock" | "layers" | "zap" | null {
  const supplied = `${label} ${value}`.replaceAll("**", "");
  if (
    /\b(?:days?|months?|hours?|días?|mes(?:es)?|horas?)\b|天|个月|小时/iu.test(
      supplied,
    )
  )
    return "clock";
  if (
    getBillDateValue(value) !== null ||
    /\b(?:date|deadline|fecha|plazo)\b|日期|截止/iu.test(supplied) ||
    (/^\d{4}$/u.test(value.trim()) && /\byear\b|\baño\b|年/iu.test(label))
  )
    return "calendar";
  if (/\b(?:MW|GW|megawatts?|gigawatts?)\b|兆瓦|吉瓦/iu.test(value)) {
    return /\b(?:per.project|project size|por proyecto)\b|项目/iu.test(label)
      ? "layers"
      : "zap";
  }
  return null;
}
