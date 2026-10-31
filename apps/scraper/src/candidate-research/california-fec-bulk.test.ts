import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { deflateRawSync } from "node:zlib";

import { resolveFecIdentityFromSource } from "@acme/validators";

import { fetchBoundedCaliforniaSource } from "./california-evidence.js";
import { decodeFecCandidateMasterZip } from "./california-fec-bulk.js";

const url = "https://www.fec.gov/files/bulk-downloads/2026/cn26.zip";
const text =
  "H6CA01269|MCGUIRE, MIKE|DEM|2026|CA|H|01|C|C|C00926519|PO BOX 340|HEALDSBURG|CA|95448|\n";

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(
  body: string | Uint8Array = text,
  name = "cn.txt",
  deflated = false,
  trailingCompressedBytes = "",
) {
  const bytes = Buffer.from(body);
  const compressed = Buffer.concat([
    deflated ? deflateRawSync(bytes) : bytes,
    Buffer.from(trailingCompressedBytes),
  ]);
  const filename = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(deflated ? 8 : 0, 8);
  local.writeUInt32LE(crc32(bytes), 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(bytes.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(deflated ? 8 : 0, 10);
  central.writeUInt32LE(crc32(bytes), 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(bytes.length, 24);
  central.writeUInt16LE(filename.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(local.length + filename.length + compressed.length, 16);
  return Buffer.concat([local, filename, compressed, central, filename, end]);
}

async function fetchZip(bytes: Uint8Array, target = url) {
  let counted = 0;
  const source = await fetchBoundedCaliforniaSource(
    "fec-master",
    target,
    "Federal Election Commission",
    "text",
    {
      request() {},
      bytes(amount) {
        counted += amount;
      },
    },
    undefined,
    {
      addresses: async () => [{ address: "93.184.216.34", family: 4 }],
      transport: async () => new Response(bytes),
    },
  );
  return { source, counted };
}

test("official FEC candidate master ZIP preserves original text and transport provenance", async () => {
  const archive = storedZip();
  const { source, counted } = await fetchZip(archive);
  assert.equal(source.text, text);
  assert.equal(source.url, url);
  assert.deepEqual(source.retrievalUrls, [url]);
  assert.equal(source.format, "text");
  assert.equal(counted, archive.length);
  assert.equal(
    source.byteHash,
    createHash("sha256").update(archive).digest("hex"),
  );
  assert.equal(
    source.contentHash,
    createHash("sha256").update(text).digest("hex"),
  );
});

test("public source HTTP 429 retains typed numeric status for bounded fallback", async () => {
  await assert.rejects(
    fetchBoundedCaliforniaSource(
      "fec-index",
      "https://api.open.fec.gov/v1/candidates/search/?office=H",
      "Federal Election Commission",
      "json",
      { request() {}, bytes() {} },
      undefined,
      {
        addresses: async () => [{ address: "93.184.216.34", family: 4 }],
        transport: async () => new Response(null, { status: 429 }),
      },
    ),
    (error: unknown) =>
      error instanceof Error &&
      error.constructor.name === "CaliforniaSourceHttpError" &&
      "status" in error &&
      error.status === 429,
  );
});

test("official FEC ZIP rejects corruption and other archive entries", async () => {
  const corrupt = storedZip();
  corrupt[40] = corrupt[40]! ^ 1;
  await assert.rejects(fetchZip(corrupt), /CRC|corrupt/i);
  await assert.rejects(
    fetchZip(storedZip(text, "other.txt")),
    /entry|cn\.txt/i,
  );
});

test("official FEC master supports bounded deflate and rejects inflated size lies", async () => {
  assert.equal(
    (await fetchZip(storedZip(text, "cn.txt", true))).source.text,
    text,
  );
  await assert.rejects(
    fetchZip(storedZip(text, "cn.txt", true, "junk")),
    /compressed length/i,
  );
  const bomb = storedZip("x".repeat(1_250_001), "cn.txt", true);
  const central = bomb.readUInt32LE(bomb.length - 6);
  bomb.writeUInt32LE(100, 22);
  bomb.writeUInt32LE(100, central + 24);
  await assert.rejects(fetchZip(bomb), /larger than|output|bound|length/i);
});

test("official FEC ZIP rejects spoofed URLs and unsupported archive structures", async () => {
  for (const target of [
    "https://example.com/files/bulk-downloads/2026/cn26.zip",
    "https://www.fec.gov/files/bulk-downloads/2026/cn24.zip",
    `${url}?copy=1`,
    `${url}#copy`,
    "https://www.fec.gov/files/bulk-downloads/2026/other.zip",
  ])
    assert.throws(
      () => decodeFecCandidateMasterZip(storedZip(), target),
      /Unsupported/,
    );
  const base = storedZip();
  await assert.rejects(
    fetchZip(base.subarray(0, -1)),
    /truncated|entry|directory/i,
  );
  await assert.rejects(
    fetchZip(Buffer.concat([base, Buffer.from("junk")])),
    /entry/i,
  );
  for (const mutate of [
    (b: Buffer, c: number) => b.writeUInt16LE(1, c + 8),
    (b: Buffer, c: number) => b.writeUInt16LE(9, c + 10),
    (b: Buffer, c: number) => b.writeUInt32LE(0xa1ff0000, c + 38),
    (b: Buffer, c: number) => b.writeUInt32LE(1, c + 42),
    (b: Buffer) => b.writeUInt16LE(1, b.length - 18),
    (b: Buffer) => b.writeUInt16LE(2, b.length - 12),
    (b: Buffer) => b.writeUInt32LE(5, 18),
  ]) {
    const archive = Buffer.from(base);
    mutate(archive, archive.readUInt32LE(archive.length - 6));
    await assert.rejects(fetchZip(archive), /entry|directory|corrupt/i);
  }
});

test("official FEC ZIP rejects invalid UTF-8 and cancels oversized compressed streams", async () => {
  await assert.rejects(
    fetchZip(storedZip(Uint8Array.of(0xff, 0xfe))),
    /encoded|encoding/i,
  );
  let canceled = false;
  let emitted = false;
  let transferred = 0;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!emitted) {
          emitted = true;
          controller.enqueue(new Uint8Array(1_000_001));
        }
      },
      cancel() {
        canceled = true;
      },
    }),
  );
  await assert.rejects(
    fetchBoundedCaliforniaSource(
      "fec-master",
      url,
      "Federal Election Commission",
      "text",
      {
        request() {},
        bytes(amount) {
          transferred += amount;
        },
      },
      undefined,
      {
        addresses: async () => [{ address: "93.184.216.34", family: 4 }],
        transport: async () => response,
      },
    ),
    /byte bound/,
  );
  assert.equal(canceled, true);
  assert.equal(transferred, 1_000_001);
});

const fecArchiveUrl =
  "https://cg-519a459a-0ea3-42c2-b7bc-fa1143481f74.s3-us-gov-west-1.amazonaws.com/bulk-downloads/2026/cn26.zip";

async function fetchRedirectedZip(
  target = fecArchiveUrl,
  calls: string[] = [],
) {
  const archive = storedZip();
  let redirects = 0;
  let transferred = 0;
  const source = await fetchBoundedCaliforniaSource(
    "fec-master",
    url,
    "Federal Election Commission",
    "text",
    {
      request() {
        redirects++;
      },
      bytes(amount) {
        transferred += amount;
      },
    },
    undefined,
    {
      addresses: async () => [{ address: "93.184.216.34", family: 4 }],
      transport: async (requestedUrl) => {
        calls.push(requestedUrl);
        return requestedUrl === url
          ? new Response(null, { status: 302, headers: { location: target } })
          : new Response(archive);
      },
    },
  );
  return { source, archive, calls, redirects, transferred };
}

test("official FEC master follows its actual government archive redirect with complete provenance", async () => {
  const { source, archive, calls, redirects, transferred } =
    await fetchRedirectedZip();
  assert.equal(source.url, url);
  assert.equal(source.text, text);
  assert.deepEqual(source.retrievalUrls, [url, fecArchiveUrl]);
  assert.deepEqual(calls, [url, fecArchiveUrl]);
  assert.equal(redirects, 1);
  assert.equal(transferred, archive.length);
  assert.equal(
    source.contentHash,
    createHash("sha256").update(text).digest("hex"),
  );
  assert.equal(
    source.byteHash,
    createHash("sha256").update(archive).digest("hex"),
  );
  assert.equal(
    resolveFecIdentityFromSource(source, {
      name: "Mike McGuire",
      district: "1",
      cycle: 2026,
    })?.candidateId,
    "H6CA01269",
  );
});

test("FEC archive redirects do not admit another bucket or election cycle", async () => {
  for (const target of [
    fecArchiveUrl.replace("cg-519a459a", "cg-00000000"),
    fecArchiveUrl.replace("2026/cn26", "2024/cn24"),
    `${fecArchiveUrl}?copy=1`,
    `${fecArchiveUrl}#copy`,
    fecArchiveUrl.replace(".com/", ".com:443/"),
    fecArchiveUrl.replace("https:", "http:"),
    "https://example.com/bulk-downloads/2026/cn26.zip",
  ]) {
    const calls: string[] = [];
    await assert.rejects(fetchRedirectedZip(target, calls), /FEC.*redirect/i);
    assert.deepEqual(calls, [url]);
  }
  await assert.rejects(fetchZip(storedZip(), fecArchiveUrl), /Unsupported/);
});

test("FEC master rejects a second redirect before requesting another source", async () => {
  const calls: string[] = [];
  let countedRedirects = 0;
  await assert.rejects(
    fetchBoundedCaliforniaSource(
      "fec-master",
      url,
      "Federal Election Commission",
      "text",
      {
        request() {
          countedRedirects++;
        },
        bytes() {},
      },
      undefined,
      {
        addresses: async () => [{ address: "93.184.216.34", family: 4 }],
        transport: async (requestedUrl) => {
          calls.push(requestedUrl);
          return new Response(null, {
            status: 302,
            headers: { location: fecArchiveUrl },
          });
        },
      },
    ),
    /FEC.*redirect/i,
  );
  assert.deepEqual(calls, [url, fecArchiveUrl]);
  assert.equal(countedRedirects, 1);
});

test("redirected FEC archive retains its compressed bound and cancels an oversized body", async () => {
  let canceled = false;
  let emitted = false;
  let transferred = 0;
  const calls: string[] = [];
  const body = new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!emitted) {
          emitted = true;
          controller.enqueue(new Uint8Array(1_000_001));
        }
      },
      cancel() {
        canceled = true;
      },
    }),
  );
  await assert.rejects(
    fetchBoundedCaliforniaSource(
      "fec-master",
      url,
      "Federal Election Commission",
      "text",
      {
        request() {},
        bytes(amount) {
          transferred += amount;
        },
      },
      undefined,
      {
        addresses: async () => [{ address: "93.184.216.34", family: 4 }],
        transport: async (requestedUrl) => {
          calls.push(requestedUrl);
          return requestedUrl === url
            ? new Response(null, {
                status: 302,
                headers: { location: fecArchiveUrl },
              })
            : body;
        },
      },
    ),
    /byte bound/,
  );
  assert.deepEqual(calls, [url, fecArchiveUrl]);
  assert.equal(canceled, true);
  assert.equal(transferred, 1_000_001);
});
