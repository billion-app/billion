import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { fetchBoundedCaliforniaSource } from "./california-evidence.js";

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

function storedZip(body = text, name = "cn.txt") {
  const bytes = Buffer.from(body);
  const filename = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc32(bytes), 14);
  local.writeUInt32LE(bytes.length, 18);
  local.writeUInt32LE(bytes.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc32(bytes), 16);
  central.writeUInt32LE(bytes.length, 20);
  central.writeUInt32LE(bytes.length, 24);
  central.writeUInt16LE(filename.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(local.length + filename.length + bytes.length, 16);
  return Buffer.concat([local, filename, bytes, central, filename, end]);
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
  await assert.rejects(fetchZip(storedZip(text, "other.txt")), /entry|cn\.txt/i);
});
