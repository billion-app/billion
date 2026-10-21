import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import sharp from "sharp";

import { eq, sql } from "@acme/db";
import * as schema from "@acme/db/schema";

import { resizeContentImages } from "./resize-content-images.js";

const databaseUrl = process.env.IMAGES_TEST_DATABASE_URL;
void test(
  "existing artwork resize preserves metadata and concurrent replacements",
  { skip: !databaseUrl },
  async (t) => {
    assert.ok(databaseUrl);
    const target = new URL(databaseUrl);
    assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
    assert.ok(target.pathname.endsWith("_test"));
    const pool = new Pool({ connectionString: databaseUrl });
    const database = drizzle(pool, { schema, casing: "snake_case" });
    const { ContentImage } = schema;
    const id = randomUUID();
    t.after(async () => {
      try {
        await database.delete(ContentImage).where(eq(ContentImage.id, id));
      } finally {
        await pool.end();
      }
    });
    assert.equal((await database.select().from(ContentImage)).length, 0);
    const original = await sharp({
      create: { width: 1024, height: 768, channels: 3, background: "#aa6699" },
    })
      .jpeg()
      .toBuffer();
    const originalHash = createHash("sha256").update(original).digest("hex");
    const objects = new Map<string, Buffer>();
    let requests = 0;
    let replaceDuringDownload: (() => Promise<void>) | undefined;
    let failReader = false;
    const server = createServer(async (request, response) => {
      requests++;
      const path = request.url?.replace("/public/", "/") ?? "";
      if (request.method === "POST") {
        if (failReader && path.endsWith("/reader.jpg")) {
          response.writeHead(503).end();
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        objects.set(path, Buffer.concat(chunks));
        response.writeHead(200).end();
        return;
      }
      if (path.endsWith("/original.jpg")) await replaceDuringDownload?.();
      const data = objects.get(path);
      response.writeHead(data ? 200 : 404).end(data);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    t.after(
      () =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const previousEnvironment = { ...process.env };
    t.after(() => {
      process.env = previousEnvironment;
    });
    process.env.POSTGRES_URL = databaseUrl;
    process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
    process.env.SUPABASE_SECRET_KEY = "test-secret";
    const options = { limit: 1, apply: true, target: "local" } as const;
    const path = `content/bill/${id}/original.jpg`;
    objects.set(`/storage/v1/object/content-images/${path}`, original);
    const record = {
      id,
      contentId: id,
      contentType: "bill",
      contentHash: "original-generation-revision",
      imageHash: originalHash,
      storagePath: path,
      prompt: "Keep the original prompt",
      width: 1024,
      height: 768,
    };
    await database.insert(ContentImage).values(record);
    await database
      .update(ContentImage)
      .set({ updatedAt: sql`'2026-10-20T12:00:00.123456Z'::timestamptz` })
      .where(eq(ContentImage.id, id));
    await resizeContentImages({ ...options, apply: false }, database);
    assert.equal(requests, 0);
    assert.equal(
      (await database.select().from(ContentImage))[0]?.storagePath,
      path,
    );

    await resizeContentImages(options, database);
    const resized = (await database.select().from(ContentImage))[0];
    assert.ok(resized);
    assert.match(resized.storagePath, /\/v1\/[a-f0-9]{64}\/reader\.jpg$/);
    assert.equal(resized.width, 1024);
    assert.equal(resized.height, 768);
    assert.equal(resized.prompt, record.prompt);
    assert.equal(resized.contentHash, record.contentHash);
    assert.ok(objects.has(`/storage/v1/object/content-images/${path}`));
    const bytes = objects.get(
      `/storage/v1/object/content-images/${resized.storagePath}`,
    );
    assert.ok(bytes);
    assert.equal(
      resized.imageHash,
      createHash("sha256").update(bytes).digest("hex"),
    );
    assert.equal(requests, 5);
    await resizeContentImages(options, database);
    assert.equal(requests, 5);

    await database
      .update(ContentImage)
      .set(record)
      .where(eq(ContentImage.id, id));
    replaceDuringDownload = async () => {
      await database
        .update(ContentImage)
        .set({
          storagePath: "concurrently-generated.jpg",
          imageHash: "new-image-hash",
          contentHash: "new-generation",
        })
        .where(eq(ContentImage.id, id));
    };
    await resizeContentImages(options, database);
    const concurrent = (await database.select().from(ContentImage))[0];
    assert.equal(concurrent?.storagePath, "concurrently-generated.jpg");
    assert.equal(concurrent?.contentHash, "new-generation");
    replaceDuringDownload = undefined;

    await database
      .update(ContentImage)
      .set(record)
      .where(eq(ContentImage.id, id));
    failReader = true;
    await assert.rejects(
      resizeContentImages(options, database),
      /upload failed/,
    );
    assert.equal(
      (await database.select().from(ContentImage))[0]?.storagePath,
      path,
    );
    failReader = false;
    objects.set(
      `/storage/v1/object/content-images/${path}`,
      Buffer.from("corrupt"),
    );
    await assert.rejects(
      resizeContentImages(options, database),
      /Original image checksum mismatch/,
    );
    assert.equal(
      (await database.select().from(ContentImage))[0]?.storagePath,
      path,
    );
    await assert.rejects(
      resizeContentImages({ ...options, target: "production" }, database),
      /Expected production database/,
    );
    process.env.SUPABASE_URL = "https://wrong.supabase.co";
    await assert.rejects(
      resizeContentImages(options, database),
      /must use the same target/,
    );
    process.env.POSTGRES_URL =
      "postgresql://postgres:fake@db.expected.supabase.co/postgres";
    await assert.rejects(
      resizeContentImages({ ...options, target: "production" }, database),
      /Storage must belong to the selected Supabase database project/,
    );
  },
);
