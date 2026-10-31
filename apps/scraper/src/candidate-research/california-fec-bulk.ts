import { inflateRawSync } from "node:zlib";

import { isOfficialFecCandidateMasterUrl } from "@acme/validators";

export const fecCandidateMasterCompressedLimit = 1_000_000;
const inflatedLimit = 1_250_000;

export function isFecCandidateMasterRedirect(
  officialUrl: string,
  redirectUrl: string,
) {
  if (!isOfficialFecCandidateMasterUrl(officialUrl)) return false;
  const path = new URL(officialUrl).pathname.slice("/files".length);
  return (
    redirectUrl ===
    `https://cg-519a459a-0ea3-42c2-b7bc-fa1143481f74.s3-us-gov-west-1.amazonaws.com${path}`
  );
}

function validExtraFields(bytes: Buffer) {
  let offset = 0;
  while (offset < bytes.length) {
    if (offset + 4 > bytes.length || bytes.readUInt16LE(offset) === 1)
      return false;
    offset += 4 + bytes.readUInt16LE(offset + 2);
  }
  return offset === bytes.length;
}

export function decodeFecCandidateMasterZip(bytes: Uint8Array, url: string) {
  if (!isOfficialFecCandidateMasterUrl(url))
    throw new Error("Unsupported FEC candidate master ZIP source");
  const buffer = Buffer.from(bytes);
  if (buffer.length < 22 || buffer.length > fecCandidateMasterCompressedLimit)
    throw new Error(
      "FEC candidate master ZIP exceeds byte bound or is truncated",
    );
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--)
    if (
      buffer.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + buffer.readUInt16LE(i + 20) === buffer.length
    ) {
      end = i;
      break;
    }
  if (
    end < 0 ||
    buffer.readUInt16LE(end + 4) !== 0 ||
    buffer.readUInt16LE(end + 6) !== 0 ||
    buffer.readUInt16LE(end + 8) !== 1 ||
    buffer.readUInt16LE(end + 10) !== 1
  )
    throw new Error("FEC candidate master ZIP must contain one cn.txt entry");
  const central = buffer.readUInt32LE(end + 16);
  const centralSize = buffer.readUInt32LE(end + 12);
  if (
    central + centralSize !== end ||
    centralSize < 46 ||
    central + 46 > end ||
    buffer.readUInt32LE(central) !== 0x02014b50
  )
    throw new Error("Invalid FEC candidate master ZIP directory");
  const flags = buffer.readUInt16LE(central + 8);
  const method = buffer.readUInt16LE(central + 10);
  const checksum = buffer.readUInt32LE(central + 16);
  const compressed = buffer.readUInt32LE(central + 20);
  const size = buffer.readUInt32LE(central + 24);
  const nameLength = buffer.readUInt16LE(central + 28);
  const extraLength = buffer.readUInt16LE(central + 30);
  const commentLength = buffer.readUInt16LE(central + 32);
  const attributes = buffer.readUInt32LE(central + 38);
  const mode = attributes >>> 16;
  const offset = buffer.readUInt32LE(central + 42);
  if (
    buffer.readUInt16LE(central + 6) > 20 ||
    flags & ~0x0800 ||
    (method !== 0 && method !== 8) ||
    size > inflatedLimit ||
    compressed > fecCandidateMasterCompressedLimit ||
    centralSize !== 46 + nameLength + extraLength + commentLength ||
    buffer.readUInt16LE(central + 34) !== 0 ||
    attributes & 0x10 ||
    ((mode & 0xf000) !== 0 && (mode & 0xf000) !== 0x8000) ||
    buffer
      .subarray(central + 46, central + 46 + nameLength)
      .toString("utf8") !== "cn.txt" ||
    !validExtraFields(
      buffer.subarray(
        central + 46 + nameLength,
        central + 46 + nameLength + extraLength,
      ),
    ) ||
    offset !== 0 ||
    offset + 30 > central ||
    buffer.readUInt32LE(offset) !== 0x04034b50
  )
    throw new Error("Invalid or oversized FEC cn.txt ZIP entry");
  const localNameLength = buffer.readUInt16LE(offset + 26);
  const localExtraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + localNameLength + localExtraLength;
  if (
    start + compressed !== central ||
    buffer.readUInt16LE(offset + 4) !== buffer.readUInt16LE(central + 6) ||
    buffer.readUInt16LE(offset + 6) !== flags ||
    buffer.readUInt16LE(offset + 8) !== method ||
    buffer.readUInt32LE(offset + 14) !== checksum ||
    buffer.readUInt32LE(offset + 18) !== compressed ||
    buffer.readUInt32LE(offset + 22) !== size ||
    buffer
      .subarray(offset + 30, offset + 30 + localNameLength)
      .toString("utf8") !== "cn.txt" ||
    !validExtraFields(buffer.subarray(offset + 30 + localNameLength, start))
  )
    throw new Error("Corrupt FEC candidate master ZIP local entry");
  const data = buffer.subarray(start, start + compressed);
  let textBytes: Uint8Array = data;
  if (method === 8) {
    const inflated: unknown = inflateRawSync(data, {
      maxOutputLength: inflatedLimit,
      info: true,
    });
    if (
      !inflated ||
      typeof inflated !== "object" ||
      !("buffer" in inflated) ||
      !Buffer.isBuffer(inflated.buffer) ||
      !("engine" in inflated) ||
      !inflated.engine ||
      typeof inflated.engine !== "object" ||
      !("bytesWritten" in inflated.engine) ||
      inflated.engine.bytesWritten !== compressed
    )
      throw new Error("Corrupt FEC candidate master ZIP compressed length");
    textBytes = inflated.buffer;
  }
  if (textBytes.length !== size || textBytes.length > inflatedLimit)
    throw new Error("Corrupt FEC candidate master ZIP output length");
  let crc = 0xffffffff;
  for (const byte of textBytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  if ((crc ^ 0xffffffff) >>> 0 !== checksum)
    throw new Error("FEC candidate master ZIP CRC mismatch");
  return new TextDecoder("utf-8", { fatal: true }).decode(textBytes);
}
