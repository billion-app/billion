import { createHash } from "node:crypto";
import { z } from "zod/v4";

import type {
  CaliforniaRosterSnapshot,
  ResearchSource,
} from "@acme/validators";
import {
  californiaRosterSnapshotSchema,
  researchSourceSchema,
} from "@acme/validators";

const manifestByteLimit = 4 * 1024 * 1024;
const archiveByteLimit = 6 * 1024 * 1024;
const sourceShape = researchSourceSchema.shape;
const {
  text: _sourceText,
  binaryBase64: _sourceBinary,
  ...metadataShape
} = sourceShape;
const referencedSourceSchema = z.strictObject({
  ...metadataShape,
  bodyArchiveKey: z.string().regex(/^roster-source:[a-f0-9]{64}$/),
});
const storedSourceSchema = z.union([
  referencedSourceSchema,
  researchSourceSchema.strict(),
]);
const storedRosterSchema = californiaRosterSnapshotSchema.extend({
  storageVersion: z.literal("archive-refs-v1"),
  additionalSources: z.array(storedSourceSchema).max(200).optional(),
  localPrimary: californiaRosterSnapshotSchema.shape.localPrimary
    .unwrap()
    .extend({
      reviewedSources: z.array(storedSourceSchema).max(200).optional(),
    })
    .optional(),
});
const archiveSchema = z.strictObject({
  schemaVersion: z.literal(1),
  format: sourceShape.format,
  text: sourceShape.text,
  contentHash: sourceShape.contentHash,
  byteHash: sourceShape.byteHash,
  binaryBase64: sourceShape.binaryBase64,
});
type Archive = z.infer<typeof archiveSchema>;
type StoredSource = z.infer<typeof storedSourceSchema>;
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
function keyFor(
  source: Pick<ResearchSource, "format" | "contentHash" | "byteHash">,
) {
  return `roster-source:${hash(JSON.stringify([source.format, source.contentHash, source.byteHash ?? null]))}`;
}
function assertBytes(value: unknown, limit: number, label: string) {
  if (Buffer.byteLength(JSON.stringify(value)) > limit)
    throw new Error(`${label} exceeds ${limit} stored JSON bytes`);
}
function bodyFor(source: ResearchSource): Archive {
  const body = archiveSchema.parse({
    schemaVersion: 1,
    format: source.format,
    text: source.text,
    contentHash: source.contentHash,
    ...(source.byteHash === undefined ? {} : { byteHash: source.byteHash }),
    ...(source.binaryBase64 === undefined
      ? {}
      : { binaryBase64: source.binaryBase64 }),
  });
  verifyBody(keyFor(source), body, source);
  return body;
}
function verifyBody(
  key: string,
  value: unknown,
  source: Pick<ResearchSource, "format" | "contentHash" | "byteHash">,
): Archive {
  assertBytes(value, archiveByteLimit, "Roster source archive");
  const body = archiveSchema.parse(value);
  if (
    key !== keyFor(source) ||
    key !== keyFor(body) ||
    body.format !== source.format ||
    body.contentHash !== source.contentHash ||
    body.byteHash !== source.byteHash ||
    hash(body.text) !== body.contentHash
  )
    throw new Error(`Roster source archive identity mismatch: ${key}`);
  if (
    body.binaryBase64 !== undefined &&
    hash(Buffer.from(body.binaryBase64, "base64")) !== body.byteHash
  )
    throw new Error(`Roster source archive binary hash mismatch: ${key}`);
  if (
    body.format === "image" &&
    (body.text !== "" || !body.binaryBase64 || !body.byteHash)
  )
    throw new Error(`Roster image archive has no verified binary: ${key}`);
  return body;
}
export function encodeCaliforniaRosterStorage(
  snapshot: CaliforniaRosterSnapshot,
) {
  const archives = new Map<string, Archive>();
  const reference = (source: ResearchSource) => {
    const body = bodyFor(source);
    const key = keyFor(source);
    const previous = archives.get(key);
    if (
      previous &&
      (previous.text !== body.text ||
        previous.binaryBase64 !== body.binaryBase64)
    )
      throw new Error(`Conflicting immutable roster source: ${key}`);
    archives.set(key, body);
    const { text: _text, binaryBase64: _binary, ...metadata } = source;
    return { ...metadata, bodyArchiveKey: key };
  };
  const additionalSources = snapshot.additionalSources?.map(reference);
  const reviewedSources = snapshot.localPrimary?.reviewedSources?.map(
    (source) => {
      const body = archives.get(keyFor(source));
      return body?.text === source.text &&
        body.binaryBase64 === source.binaryBase64
        ? reference(source)
        : source;
    },
  );
  const document = storedRosterSchema.parse({
    ...snapshot,
    storageVersion: "archive-refs-v1",
    ...(additionalSources === undefined ? {} : { additionalSources }),
    ...(snapshot.localPrimary === undefined
      ? {}
      : {
          localPrimary: {
            ...snapshot.localPrimary,
            ...(reviewedSources === undefined ? {} : { reviewedSources }),
          },
        }),
  });
  assertBytes(document, manifestByteLimit, "Roster stored manifest");
  return { document, archives };
}
export async function hydrateCaliforniaRosterStorage(
  value: unknown,
  readArchive: (
    key: string,
  ) => Promise<{ kind: string; document: unknown } | undefined>,
): Promise<CaliforniaRosterSnapshot> {
  if (!value || typeof value !== "object" || !("storageVersion" in value))
    return californiaRosterSnapshotSchema.parse(value);
  assertBytes(value, manifestByteLimit, "Roster stored manifest");
  const { storageVersion: _version, ...stored } =
    storedRosterSchema.parse(value);
  const bodies = new Map<string, Archive>();
  async function hydrate(source: StoredSource): Promise<ResearchSource> {
    if (!("bodyArchiveKey" in source))
      return researchSourceSchema.parse(source);
    const { bodyArchiveKey, ...metadata } = source;
    let body = bodies.get(bodyArchiveKey);
    if (!body) {
      const row = await readArchive(bodyArchiveKey);
      if (row?.kind !== "roster_source_archive")
        throw new Error(`Missing roster source archive: ${bodyArchiveKey}`);
      body = verifyBody(bodyArchiveKey, row.document, metadata);
      bodies.set(bodyArchiveKey, body);
    } else verifyBody(bodyArchiveKey, body, metadata);
    return researchSourceSchema.parse({
      ...metadata,
      text: body.text,
      ...(body.binaryBase64 === undefined
        ? {}
        : { binaryBase64: body.binaryBase64 }),
    });
  }
  async function hydrateSources(sources: StoredSource[] | undefined) {
    if (!sources) return undefined;
    const result: ResearchSource[] = [];
    for (const source of sources) result.push(await hydrate(source));
    return result;
  }
  const additionalSources = await hydrateSources(stored.additionalSources);
  const reviewedSources = await hydrateSources(
    stored.localPrimary?.reviewedSources,
  );
  return californiaRosterSnapshotSchema.parse({
    ...stored,
    ...(additionalSources === undefined ? {} : { additionalSources }),
    ...(stored.localPrimary === undefined
      ? {}
      : {
          localPrimary: {
            ...stored.localPrimary,
            ...(reviewedSources === undefined ? {} : { reviewedSources }),
          },
        }),
  });
}
export function verifyCaliforniaRosterArchive(
  key: string,
  actual: unknown,
  expected: Archive,
) {
  const body = verifyBody(key, actual, expected);
  if (
    body.text !== expected.text ||
    body.binaryBase64 !== expected.binaryBase64
  )
    throw new Error(`Conflicting immutable roster source: ${key}`);
}
