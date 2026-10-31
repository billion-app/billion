import { createHash } from "node:crypto";
import { z } from "zod/v4";

import type {
  AuthorityRenewalProjection,
  AuthorityRenewalProof,
  ResearchSource,
} from "@acme/validators";
import { authorityRenewalProjectionSchema } from "@acme/validators";

const hash = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const canonical = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(",")}]`
    : value !== null && typeof value === "object"
      ? `{${Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => `${JSON.stringify(key)}:${canonical(value)}`)
          .join(",")}}`
      : JSON.stringify(value);
export const authorityProjectionURLs = {
  "cde-item-48870daecfe14c6ab376f6a673491914-telemetry-v1":
    "https://www.arcgis.com/sharing/rest/content/items/48870daecfe14c6ab376f6a673491914?f=json",
  "cde-data-ca-gov-school-district-areas-2025-26-related-harvest-v1":
    "https://data.ca.gov/@california-department-of-education/california-school-district-areas-2025-26",
  "mvla-trustee-authority-seven-asset-versions-v1":
    "https://www.mvla.net/trustee-area-election-information",
} as const;
const assetTemplates = [
  '<script src="/js/slick-a11y.js?v={version}">',
  '<link rel="stylesheet" type="text/css" href="/css/main-sass.css?v={version}">',
  '<script src="/js/classes/ColorContrast.js?v={version}">',
  '<script src="/js/stack_items.js?v={version}">',
  '<script type="module" src="/js/components.js?v={version}">',
  '<script src="/js/general.js?v={version}">',
  '<script src="/js/deviceDetector.js?v={version}">',
];
function strictJson(
  text: string,
  selectedString?: (
    path: (string | number)[],
    value: string,
    start: number,
    end: number,
  ) => void,
): unknown {
  let position = 0;
  const whitespace = () => {
    while (/[\x20\t\r\n]/.test(text[position] ?? "x")) position++;
  };
  const string = () => {
    const start = position;
    if (text[position++] !== '"') throw new Error("Expected JSON string");
    for (; position < text.length; position++) {
      if (text[position] === "\\") {
        position++;
        continue;
      }
      if (text[position] === '"') {
        position++;
        return JSON.parse(text.slice(start, position)) as string;
      }
    }
    throw new Error("Unterminated JSON string");
  };
  const value = (depth: number, path: (string | number)[] = []): void => {
    if (depth > 100) throw new Error("JSON nesting exceeds bound");
    whitespace();
    const first = text[position];
    if (first === '"') {
      const start = position;
      const decoded = string();
      selectedString?.(path, decoded, start + 1, position - 1);
      return;
    }
    if (first === "{") {
      position++;
      whitespace();
      const keys = new Set<string>();
      if (text[position] === "}") {
        position++;
        return;
      }
      for (;;) {
        whitespace();
        const key = string();
        if (keys.has(key)) throw new Error("Duplicate JSON key");
        keys.add(key);
        whitespace();
        if (text[position++] !== ":") throw new Error("Expected JSON colon");
        value(depth + 1, selectedString ? [...path, key] : []);
        whitespace();
        const end = text[position++];
        if (end === "}") return;
        if (end !== ",") throw new Error("Invalid JSON object separator");
      }
    }
    if (first === "[") {
      position++;
      whitespace();
      if (text[position] === "]") {
        position++;
        return;
      }
      let index = 0;
      for (;;) {
        value(depth + 1, selectedString ? [...path, index++] : []);
        whitespace();
        const end = text[position++];
        if (end === "]") return;
        if (end !== ",") throw new Error("Invalid JSON array separator");
      }
    }
    const match =
      /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
        text.slice(position),
      );
    if (!match) throw new Error("Invalid JSON value");
    position += match[0].length;
  };
  value(0);
  whitespace();
  if (position !== text.length) throw new Error("Trailing JSON content");
  const parsed: unknown = JSON.parse(text);
  const finite = (value: unknown): void => {
    if (typeof value === "number" && !Number.isFinite(value))
      throw new Error("Nonfinite JSON number");
    if (Array.isArray(value)) value.forEach(finite);
    else if (value !== null && typeof value === "object")
      Object.values(value).forEach(finite);
  };
  finite(parsed);
  return parsed;
}
function validVersion(version: string) {
  if (!/^\d{14}$/.test(version)) return false;
  const year = Number(version.slice(0, 4)),
    month = Number(version.slice(4, 6)),
    day = Number(version.slice(6, 8)),
    hour = Number(version.slice(8, 10)),
    minute = Number(version.slice(10, 12)),
    second = Number(version.slice(12, 14));
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

const relatedDatasetIds = [
  "6ad5b9d2-58e3-4181-bfb5-851ab41b7fe3",
  "1c6303ae-ec57-44d2-8268-f114f6c7d084",
  "383edcbb-fc51-422e-b537-36b48bd9c5be",
];
function projectRelatedHarvest(text: string) {
  const opening = '<script id="__NEXT_DATA__" type="application/json">';
  const scripts = [
    ...text.matchAll(
      /<script\b[^>]*\bid\s*=\s*(?:"__NEXT_DATA__"|'__NEXT_DATA__'|__NEXT_DATA__(?=[\s>]))[^>]*>/gi,
    ),
  ];
  const script = scripts[0];
  if (scripts.length !== 1 || script?.[0] !== opening)
    throw new Error("CDE catalogue requires one exact NEXT_DATA script");
  const start = script.index + opening.length;
  const end = text.indexOf("</script>", start);
  if (end < 0) throw new Error("CDE catalogue JSON script is unterminated");
  const json = text.slice(start, end);
  const spans = new Map<
    string,
    { value: string; start: number; end: number }
  >();
  const paths = relatedDatasetIds.map((_, index) =>
    JSON.stringify([
      "props",
      "pageProps",
      "relatedDatasets",
      index,
      "extras",
      4,
      "value",
    ]),
  );
  const parsed = strictJson(json, (path, value, begin, finish) => {
    const key = JSON.stringify(path);
    if (paths.includes(key))
      spans.set(key, { value, start: begin, end: finish });
  });
  const page = z
    .object({
      props: z.object({
        pageProps: z.object({
          dataset: z.object({
            id: z.literal("9a9f7021-d72d-4bdf-8828-1014fc494561"),
          }),
          relatedDatasets: z
            .array(
              z.object({
                id: z.string(),
                extras: z.array(
                  z.object({ key: z.string(), value: z.unknown() }),
                ),
              }),
            )
            .length(3),
        }),
      }),
    })
    .parse(parsed).props.pageProps;
  const ranges: { start: number; end: number; token: string }[] = [];
  const values = new Set<string>();
  for (const [index, id] of relatedDatasetIds.entries()) {
    const related = page.relatedDatasets[index];
    const extra = related?.extras[4];
    const path = paths[index];
    const span = path === undefined ? undefined : spans.get(path);
    const token = `__RELATED_HARVEST_OBJECT_ID_${index}__`;
    if (
      !related ||
      related.id !== id ||
      !extra ||
      extra.key !== "harvest_object_id" ||
      related.extras.filter((item) => item.key === "harvest_object_id")
        .length !== 1 ||
      !span ||
      span.value !== extra.value ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        span.value,
      ) ||
      json.slice(span.start, span.end) !== span.value ||
      text.split(span.value).length !== 2 ||
      text.includes(token) ||
      values.has(span.value)
    )
      throw new Error(
        "CDE catalogue related harvest identity or raw UUID span changed",
      );
    values.add(span.value);
    ranges.push({ start: start + span.start, end: start + span.end, token });
  }
  let projected = text;
  for (const range of ranges.sort((a, b) => b.start - a.start))
    projected =
      projected.slice(0, range.start) +
      range.token +
      projected.slice(range.end);
  return projected;
}

export function projectAuthoritySource(
  projectionId: AuthorityRenewalProjection["projectionId"],
  text: string,
): string {
  if (text.length > 5_000_000)
    throw new Error("Authority source exceeds projection bound");
  if (
    projectionId ===
    "cde-data-ca-gov-school-district-areas-2025-26-related-harvest-v1"
  )
    return projectRelatedHarvest(text);
  if (
    projectionId === "cde-item-48870daecfe14c6ab376f6a673491914-telemetry-v1"
  ) {
    const parsed = strictJson(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("CDE item must be a JSON object");
    const item = parsed as Record<string, unknown>;
    if (item.id !== "48870daecfe14c6ab376f6a673491914")
      throw new Error("CDE item identity changed");
    for (const field of ["lastViewed", "numViews"]) {
      const value = item[field];
      if (
        !Object.hasOwn(item, field) ||
        !Number.isSafeInteger(value) ||
        ((value as number) < 0 && !(field === "lastViewed" && value === -1))
      )
        throw new Error(
          field === "lastViewed"
            ? "CDE telemetry lastViewed must be -1 or a nonnegative integer"
            : "CDE telemetry numViews is not a nonnegative integer",
        );
    }
    const retained = { ...item };
    delete retained.lastViewed;
    delete retained.numViews;
    return canonical(retained);
  }
  if (projectionId !== "mvla-trustee-authority-seven-asset-versions-v1")
    throw new Error("Unapproved authority projector");
  let version: string | undefined;
  let projected = text;
  for (const template of assetTemplates) {
    const [start, end] = template.split("{version}");
    const escaped = (value: string) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `${escaped(start!)}(\\d{14})${escaped(end!)}`,
      "g",
    );
    const matches = [...projected.matchAll(pattern)];
    if (matches.length !== 1 || !validVersion(matches[0]![1]!))
      throw new Error(
        "MVLA asset tag missing, duplicated, or invalid calendar version",
      );
    const observed = matches[0]![1]!;
    if (version && version !== observed)
      throw new Error("MVLA asset versions are inconsistent");
    version = observed;
    projected = projected.replace(pattern, `${start}[CACHE_VERSION]${end}`);
  }
  return projected;
}
export function validateAuthorityRenewalProjection(
  value: unknown,
  observed: ResearchSource,
  scopeDigest: string,
): { contract: AuthorityRenewalProjection; proof: AuthorityRenewalProof } {
  const contract = authorityRenewalProjectionSchema.parse(value);
  const original = contract.reviewedSource;
  if (
    contract.url !== authorityProjectionURLs[contract.projectionId] ||
    contract.approval.scopeDigest !== scopeDigest
  )
    throw new Error("Authority projection URL or approved scope mismatch");
  for (const source of [original, observed])
    if (
      source.url !== contract.url ||
      source.publisher !== contract.publisher ||
      source.format !== contract.format ||
      hash(source.text) !== source.contentHash
    )
      throw new Error(
        "Authority projection source metadata or text hash mismatch",
      );
  if (
    original.contentHash !== contract.reviewedContentHash ||
    hash(original.text) !== contract.reviewedRawHash ||
    (original.byteHash && original.byteHash !== contract.reviewedRawHash)
  )
    throw new Error("Authority projection reviewed raw archive changed");
  if (!observed.byteHash || hash(observed.text) !== observed.byteHash)
    throw new Error(
      "Authority projection requires actual raw UTF8 response hash",
    );
  const originalDigest = hash(
    projectAuthoritySource(contract.projectionId, original.text),
  );
  const observedDigest = hash(
    projectAuthoritySource(contract.projectionId, observed.text),
  );
  if (
    originalDigest !== contract.canonicalDigest ||
    observedDigest !== contract.canonicalDigest
  )
    throw new Error(
      "Authority source changed outside the explicitly approved projection",
    );
  return {
    contract,
    proof: {
      projectionId: contract.projectionId,
      url: contract.url,
      publisher: contract.publisher,
      format: contract.format,
      reviewedContentHash: contract.reviewedContentHash,
      reviewedRawHash: contract.reviewedRawHash,
      observedContentHash: observed.contentHash,
      observedRawHash: observed.byteHash,
      canonicalDigest: contract.canonicalDigest,
      approvalReceiptHash: contract.approval.receiptHash,
      checkedAt: observed.fetchedAt,
    },
  };
}
export const authorityProjectionDigest = (
  projectionId: AuthorityRenewalProjection["projectionId"],
  text: string,
) => hash(projectAuthoritySource(projectionId, text));
