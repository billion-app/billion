/**
 * Which visual a set of brief facts can honestly support.
 *
 * Shared by the scraper, which verifies a generated layout before storing it,
 * and the readers, which draw it. Each test is conservative: a scale needs two
 * proposed thresholds in one unit, a timeline needs two complete calendar
 * dates, and a percentage needs one bounded value. Anything else is drawn as
 * plain metrics, so a visual never implies a comparison the source lacks.
 */

/** The parts of a fact these checks read; readers may carry more. */
export interface FigureFact {
  label: string;
  value: string;
  note?: string;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  enero: 1,
  feb: 2,
  february: 2,
  febrero: 2,
  mar: 3,
  march: 3,
  marzo: 3,
  apr: 4,
  april: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  june: 6,
  junio: 6,
  jul: 7,
  july: 7,
  julio: 7,
  aug: 8,
  august: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  september: 9,
  septiembre: 9,
  oct: 10,
  october: 10,
  octubre: 10,
  nov: 11,
  november: 11,
  noviembre: 11,
  dec: 12,
  december: 12,
  diciembre: 12,
};

/** Only complete, unambiguous calendar dates earn chronological placement.
 * Relative deadlines and recurrence clauses stay in their original fact group.
 */
export function getBillDateValue(value: string): number | null {
  const plain = value.replaceAll("**", "").trim().toLowerCase();
  let year: number;
  let month: number;
  let day: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(plain);
  const chinese = /^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日$/u.exec(plain);
  const english = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/u.exec(plain);
  const dayFirst =
    /^(\d{1,2})\s+(?:de\s+)?([a-z]+)\.?\s+(?:de\s+)?(\d{4})$/u.exec(plain);
  if (iso || chinese) {
    const parts = iso ?? chinese;
    year = Number(parts?.[1]);
    month = Number(parts?.[2]);
    day = Number(parts?.[3]);
  } else if (english) {
    year = Number(english[3]);
    month = MONTHS[english[1] ?? ""] ?? 0;
    day = Number(english[2]);
  } else if (dayFirst) {
    year = Number(dayFirst[3]);
    month = MONTHS[dayFirst[2] ?? ""] ?? 0;
    day = Number(dayFirst[1]);
  } else return null;
  if (
    year < 1000 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date.getTime()
    : null;
}

export function getBillDateMilestones<F extends FigureFact>(
  facts: readonly F[],
) {
  const dates = facts
    .flatMap((fact, index) => {
      const date = getBillDateValue(fact.value);
      return date === null ? [] : [{ fact, index, date }];
    })
    .sort((a, b) => a.date - b.date);
  return new Set(dates.map((point) => point.date)).size >= 2 ? dates : [];
}

/**
 * Two values of one measure on a shared axis. A heat scale keeps the
 * thresholds' own padded range; a quantity scale always starts at zero, so the
 * drawing never exaggerates a small difference between two amounts.
 */
export interface ScaleFigure<F extends FigureFact = FigureFact> {
  kind: "scale";
  measure: "heat" | "quantity";
  points: [ScalePoint<F>, ScalePoint<F>];
  supporting: F[];
  min: number;
  max: number;
}
export type ScalePoint<F extends FigureFact> = F & {
  amount: number;
  /** The value as drawn beside its marker. */
  display: string;
  /** Wording shared by both values, such as "per home". */
  qualifier?: string;
};
export interface MetricFigure<F extends FigureFact = FigureFact> {
  kind: "metrics";
  points: [F, ...F[]];
}

function scaleOf<F extends FigureFact>(
  facts: readonly F[],
  measure: ScaleFigure["measure"],
  candidates: {
    fact: F;
    amount: number;
    display: string;
    qualifier?: string;
    unit: string;
  }[],
): ScaleFigure<F> | null {
  const units = new Map<string, typeof candidates>();
  for (const candidate of candidates)
    units.set(candidate.unit, [
      ...(units.get(candidate.unit) ?? []),
      candidate,
    ]);
  for (const group of units.values()) {
    // More than two values require a different graphic, not silent omission.
    if (group.length !== 2) continue;
    const [first, second] = [...group].sort((a, b) => a.amount - b.amount);
    if (
      !first ||
      !second ||
      !Number.isFinite(first.amount) ||
      !Number.isFinite(second.amount) ||
      first.amount === second.amount
    )
      continue;
    const padding = (second.amount - first.amount) / 2;
    const point = (candidate: typeof first): ScalePoint<F> => ({
      ...candidate.fact,
      amount: candidate.amount,
      display: candidate.display,
      ...(candidate.qualifier ? { qualifier: candidate.qualifier } : {}),
    });
    return {
      kind: "scale",
      measure,
      points: [point(first), point(second)],
      supporting: facts.filter(
        (fact) => fact !== first.fact && fact !== second.fact,
      ),
      min: measure === "heat" ? first.amount - padding : 0,
      max: measure === "heat" ? second.amount + padding : second.amount * 1.15,
    };
  }
  return null;
}

/** Two proposed heat-index thresholds in one unit. */
function heatScale<F extends FigureFact>(facts: readonly F[]) {
  return scaleOf(
    facts,
    "heat",
    facts.flatMap((fact) => {
      const match =
        /^(-?\d+(?:\.\d+)?)\s*°([FC])\s+(?:heat index|índice de calor|热指数)$/iu.exec(
          fact.value.replaceAll("**", "").trim(),
        );
      if (!match || !/(?:propos|拟议|提案)/iu.test(fact.note ?? "")) return [];
      const unit = match[2]?.toUpperCase() ?? "";
      return [
        {
          fact,
          amount: Number(match[1]),
          display: `${match[1]}°${unit}`,
          unit,
        },
      ];
    }),
  );
}

/**
 * Two plain amounts written with the same currency and qualifier, such as
 * "$25,000 per home" and "$50,000 per home". Prefixed limits ("Up to"),
 * ranges, percentages and dates keep their own presentations.
 */
function quantityScale<F extends FigureFact>(facts: readonly F[]) {
  return scaleOf(
    facts,
    "quantity",
    facts.flatMap((fact) => {
      const display = getBillFactDisplay(fact.value);
      if (!display.numeric || "prefix" in display) return [];
      const match = /^([$€£¥]?)(\d[\d,]*(?:\.\d+)?)$/u.exec(display.value);
      if (!match) return [];
      const amount = Number((match[2] ?? "").replaceAll(",", ""));
      if (!Number.isFinite(amount) || amount < 0) return [];
      return [
        {
          fact,
          amount,
          display: display.value,
          qualifier: display.qualifier,
          unit: `${match[1]}|${display.qualifier.toLowerCase()}`,
        },
      ];
    }),
  );
}

/** Only a shared, explicit unit earns a scale. Dates and unrelated quantities
 * never become comparable bars; supplied qualifiers stay with every value.
 * Without a writer's request, only heat thresholds are drawn on a scale. */
export function getBillFactFigure<F extends FigureFact>(
  facts: readonly F[],
): ScaleFigure<F> | MetricFigure<F> | null {
  const heat = heatScale(facts);
  if (heat) return heat;
  const [first, ...rest] = facts;
  return first ? { kind: "metrics", points: [first, ...rest] } : null;
}

/**
 * The scale a writer asked for, when the facts support one. Sharing a unit
 * does not make two amounts comparable (a $200B ceiling and a $5B program
 * are not one measure), which is why a quantity scale needs the writer's
 * explicit choice and is never inferred.
 */
export function getBillScaleFigure<F extends FigureFact>(
  facts: readonly F[],
): ScaleFigure<F> | null {
  return heatScale(facts) ?? quantityScale(facts);
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

/** A percentage earns a position on a labelled 0–100% axis, never a pie or
 * invented part-of-whole claim. Ranges and compound values stay written. */
export function getBillPercent(value: string): number | null {
  const display = getBillFactDisplay(value);
  if (!display.numeric || !/^\d+(?:\.\d+)?%$/u.test(display.value)) return null;
  // A second quantity needs its own explanation, not a single plotted point.
  if (/\d|%/u.test(display.qualifier)) return null;
  const amount = Number(display.value.slice(0, -1));
  return amount >= 0 && amount <= 100 ? amount : null;
}

/** Use supplied quantitative evidence when possible; every other structured
 * bill gets a parallel map of its supplied changes, including empty facts. */
export function getBillVisualKind(facts: readonly FigureFact[]) {
  const figure = getBillFactFigure(facts);
  if (figure?.kind === "scale") return "scale";
  if (getBillDateMilestones(facts).length) return "dates";
  if (facts.some((fact) => getBillPercent(fact.value) !== null))
    return "percentage";
  return "changes";
}
