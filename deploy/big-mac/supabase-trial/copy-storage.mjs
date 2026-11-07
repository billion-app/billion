import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const root = resolve(process.argv[2] ?? ".");
const sourceFile = resolve(
  process.argv[3] ?? `${homedir()}/.config/billion/scraper.env`,
);
const source = parseEnv(readFileSync(sourceFile, "utf8"));
const target = parseEnv(readFileSync(`${root}/.env`, "utf8"));
const manifest = JSON.parse(
  readFileSync(`${root}/backup/manifest.json`, "utf8"),
);
readFileSync(`${root}/backup/database-verified.json`);
if (
  manifest.sourceProject !== "gltwmqkdminbyqzmfich" ||
  target.POOLER_TENANT_ID !== "billion-trial"
) {
  throw new Error(
    "Expected Billion production snapshot and isolated trial credentials.",
  );
}
const sourceOrigin = "https://gltwmqkdminbyqzmfich.supabase.co";
const targetOrigin = "http://127.0.0.1:8006";
const headers = {
  apikey: target.SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${target.SUPABASE_SECRET_KEY}`,
};
const sourceHeaders = {
  apikey: source.SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${source.SUPABASE_SECRET_KEY}`,
};
const encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const request = (url, options) =>
  fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
async function requireOk(response, operation) {
  if (!response.ok)
    throw new Error(
      `${operation} failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`,
    );
  return response;
}
for (const bucket of manifest.buckets) {
  const existing = await request(
    `${targetOrigin}/storage/v1/bucket/${encodeURIComponent(bucket.id)}`,
    { headers },
  );
  if (existing.ok) continue;
  if (existing.status !== 404 && existing.status !== 400)
    await requireOk(existing, "Inspect destination bucket");
  await requireOk(
    await request(`${targetOrigin}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: bucket.id,
        name: bucket.name,
        public: bucket.public,
        file_size_limit: bucket.file_size_limit,
        allowed_mime_types: bucket.allowed_mime_types,
      }),
    }),
    "Create destination bucket",
  );
}
const bucket = { id: `trial-smoke-${randomUUID()}` };
await requireOk(
  await request(`${targetOrigin}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ id: bucket.id, name: bucket.id, public: true }),
  }),
  "Create temporary smoke bucket",
);
const smokePath = `__trial_smoke__/${randomUUID()}.png`;
const smokeBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9XkAAAAASUVORK5CYII=",
  "base64",
);
try {
  await requireOk(
    await request(
      `${targetOrigin}/storage/v1/object/${bucket.id}/${smokePath}`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "image/png" },
        body: smokeBytes,
      },
    ),
    "Trial upload",
  );
  const smokeResponse = await requireOk(
    await request(
      `${targetOrigin}/storage/v1/object/public/${bucket.id}/${smokePath}`,
    ),
    "Trial public download",
  );
  if (hash(Buffer.from(await smokeResponse.arrayBuffer())) !== hash(smokeBytes))
    throw new Error("Trial image checksum differs.");
} finally {
  await requireOk(
    await request(`${targetOrigin}/storage/v1/object/${bucket.id}`, {
      method: "DELETE",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [smokePath] }),
    }),
    "Remove trial upload",
  );
  await requireOk(
    await request(`${targetOrigin}/storage/v1/bucket/${bucket.id}`, {
      method: "DELETE",
      headers,
    }),
    "Remove temporary smoke bucket",
  );
}
console.log(
  "Trial storage upload, public download, checksum, and deletion passed.",
);
let copied = 0;
let skipped = 0;
let blockedStatus;
const pending = [...manifest.objects];
async function copyNext() {
  while (pending.length && !blockedStatus) {
    const object = pending.shift();
    const path = `${encodeURIComponent(object.bucket_id)}/${encodePath(object.name)}`;
    const expectedHash = /\/([a-f0-9]{64})\.[a-z]+$/i.exec(object.name)?.[1];
    const existing = await request(
      `${targetOrigin}/storage/v1/object/authenticated/${path}`,
      { headers },
    );
    if (existing.ok && expectedHash) {
      if (hash(Buffer.from(await existing.arrayBuffer())) === expectedHash) {
        skipped++;
        continue;
      }
    } else {
      await existing.body?.cancel();
    }
    const response = await request(
      `${sourceOrigin}/storage/v1/object/authenticated/${path}`,
      { headers: sourceHeaders },
    );
    if (response.status === 402) {
      blockedStatus = response.status;
      await response.body?.cancel();
      return;
    }
    await requireOk(response, "Read production object");
    const bytes = Buffer.from(await response.arrayBuffer());
    const checksum = hash(bytes);
    if (expectedHash && checksum !== expectedHash)
      throw new Error("Production object does not match its immutable path.");
    if (Number(object.metadata?.size) !== bytes.length)
      throw new Error("Production object size differs from snapshot.");
    await requireOk(
      await request(`${targetOrigin}/storage/v1/object/${path}`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": object.metadata.mimetype,
          "Cache-Control": object.metadata.cacheControl ?? "max-age=31536000",
          "x-upsert": "true",
        },
        body: bytes,
      }),
      "Write trial object",
    );
    const verification = await requireOk(
      await request(`${targetOrigin}/storage/v1/object/authenticated/${path}`, {
        headers,
      }),
      "Read trial object",
    );
    if (hash(Buffer.from(await verification.arrayBuffer())) !== checksum)
      throw new Error("Copied image checksum differs.");
    copied++;
    if (copied % 100 === 0)
      console.log(`Copied and verified ${copied} images.`);
  }
}
// Probe one object before starting the parallel copy, including when quota blocks reads.
const first = pending.splice(1);
await copyNext();
pending.push(...first);
if (!blockedStatus)
  await Promise.all([copyNext(), copyNext(), copyNext(), copyNext()]);
const report = {
  checkedAt: new Date().toISOString(),
  storageSmokePassed: true,
  expected: manifest.objects.length,
  copied,
  skipped,
  status: blockedStatus ? "blocked-by-source-quota" : "verified",
  sourceHttpStatus: blockedStatus,
};
writeFileSync(
  `${root}/backup/storage-status.json`,
  JSON.stringify(report, null, 2) + "\n",
  { mode: 0o600 },
);
console.log(JSON.stringify(report));
if (blockedStatus) process.exitCode = 2;
