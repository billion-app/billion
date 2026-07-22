import { Writable } from "node:stream";

import { Client } from "basic-ftp";

import type { TexasDocument } from "./texas-legislature-parser.js";

export interface BulkEntry {
  name: string;
  isDirectory: boolean;
}

export interface TexasBulkClient {
  list(path: string): Promise<BulkEntry[]>;
  download(path: string): Promise<Buffer>;
  close(): void;
}

export class TexasFtpClient implements TexasBulkClient {
  private readonly client = new Client(30_000);

  async connect(): Promise<void> {
    await this.client.access({
      host: "ftp.legis.state.tx.us",
      user: "anonymous",
      password: "billion@example.invalid",
      secure: false,
    });
  }

  async list(path: string): Promise<BulkEntry[]> {
    return (await this.client.list(path)).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory,
    }));
  }

  async download(path: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk: Buffer | string, _encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        callback();
      },
    });
    await this.client.downloadTo(sink, path);
    return Buffer.concat(chunks);
  }

  close(): void {
    this.client.close();
  }
}

export function selectCurrentTexasSession(names: readonly string[]): string {
  const sessions = names
    .map((name) => name.toUpperCase())
    .filter((name) => /^\d{2}(?:R|\d)$/.test(name))
    .sort((left, right) => {
      const legislature = Number(left.slice(0, 2)) - Number(right.slice(0, 2));
      if (legislature !== 0) return legislature;
      const rank = (value: string) =>
        value[2] === "R" ? 0 : Number(value[2]) || 0;
      return rank(left) - rank(right);
    });
  const session = sessions.at(-1);
  if (!session) throw new Error("No Texas legislative sessions found in /bills");
  return session;
}

export async function listFilesRecursively(
  client: TexasBulkClient,
  root: string,
): Promise<string[]> {
  const entries = (await client.list(root)).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "." || entry.name === "..") continue;
    const child = `${root.replace(/\/$/, "")}/${entry.name}`;
    if (entry.isDirectory) files.push(...(await listFilesRecursively(client, child)));
    else files.push(child);
  }
  return files;
}

const folderByPrefix: Record<string, string> = {
  HB: "house_bills",
  HCR: "house_concurrent_resolutions",
  HJR: "house_joint_resolutions",
  HR: "house_resolutions",
  SB: "senate_bills",
  SCR: "senate_concurrent_resolutions",
  SJR: "senate_joint_resolutions",
  SR: "senate_resolutions",
};

const rootByType: Record<TexasDocument["type"], string> = {
  bill_text: "billtext",
  analysis: "analysis",
  fiscal_note: "fiscalnotes",
};

export function bulkHtmlPath(
  session: string,
  document: Pick<TexasDocument, "type" | "htmlUrl" | "ftpHtmlUrl">,
): string | undefined {
  if (document.ftpHtmlUrl) {
    try {
      return decodeURIComponent(new URL(document.ftpHtmlUrl).pathname);
    } catch {
      return undefined;
    }
  }
  if (!document.htmlUrl) return undefined;
  let filename: string;
  try {
    filename = new URL(document.htmlUrl).pathname.split("/").at(-1) ?? "";
  } catch {
    return undefined;
  }
  const match = /^(HCR|HJR|HR|HB|SCR|SJR|SR|SB)(\d{5})[A-Z0-9]*\.html?$/i.exec(
    filename,
  );
  if (!match) return undefined;
  const prefix = match[1]!.toUpperCase();
  const number = Number(match[2]);
  const start = number < 100 ? 1 : Math.floor(number / 100) * 100;
  const end = number < 100 ? 99 : start + 99;
  const pad = (value: number) => String(value).padStart(5, "0");
  const documentRoot =
    document.type === "fiscal_note" ? "fiscalNotes" : rootByType[document.type];
  return `/bills/${session.toUpperCase()}/${documentRoot}/HTML/${folderByPrefix[prefix]}/${prefix}${pad(start)}_${prefix}${pad(end)}/${filename}`;
}
