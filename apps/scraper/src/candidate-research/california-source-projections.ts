import { createHash } from "node:crypto";

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
function strictJson(text: string): unknown {
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
  const value = (depth: number): void => {
    if (depth > 100) throw new Error("JSON nesting exceeds bound");
    whitespace();
    const first = text[position];
    if (first === '"') {
      string();
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
        value(depth + 1);
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
      for (;;) {
        value(depth + 1);
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
export function projectAuthoritySource(
  projectionId: AuthorityRenewalProjection["projectionId"],
  text: string,
): string {
  if (text.length > 5_000_000)
    throw new Error("Authority source exceeds projection bound");
  if (
    projectionId === "cde-item-48870daecfe14c6ab376f6a673491914-telemetry-v1"
  ) {
    const parsed = strictJson(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("CDE item must be a JSON object");
    const item = parsed as Record<string, unknown>;
    if (item.id !== "48870daecfe14c6ab376f6a673491914")
      throw new Error("CDE item identity changed");
    for (const field of ["lastViewed", "numViews"])
      if (
        !Object.hasOwn(item, field) ||
        !Number.isSafeInteger(item[field]) ||
        (item[field] as number) < 0
      )
        throw new Error("CDE telemetry is not a nonnegative integer");
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
