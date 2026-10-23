import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import sharp from "sharp";

import { uploadContentImage } from "./utils/storage/content-images.js";

void test("publishes verified card and reader images with actual dimensions", async (t) => {
  const objects = new Map<string, Buffer>();
  let corrupt = false;
  let failReader = false;
  const server = createServer(async (request, response) => {
    const path = request.url?.replace("/public/", "/") ?? "";
    if (request.method === "POST") {
      if (failReader && path.endsWith("/reader.jpg")) {
        response.writeHead(503).end();
        return;
      }
      assert.equal(request.headers["cache-control"], "max-age=31536000");
      assert.equal(request.headers["content-type"], "image/jpeg");
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      objects.set(path, Buffer.concat(chunks));
      response.writeHead(200).end();
      return;
    }
    const data = objects.get(path);
    response
      .writeHead(data ? 200 : 404)
      .end(corrupt ? Buffer.from("corrupt") : data);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
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
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SECRET_KEY = "test-secret";

  const data = await sharp({
    create: { width: 1600, height: 1200, channels: 3, background: "#7799aa" },
  })
    .png()
    .toBuffer();
  const stored = await uploadContentImage({
    contentType: "bill",
    contentId: "test-id",
    data,
  });
  assert.equal(stored.width, 1280);
  assert.equal(stored.height, 960);
  assert.match(
    stored.path,
    /^content\/bill\/test-id\/v1\/[a-f0-9]{64}\/reader\.jpg$/,
  );
  const reader = objects.get(
    `/storage/v1/object/content-images/${stored.path}`,
  );
  const card = objects.get(
    `/storage/v1/object/content-images/${stored.path.replace("reader.jpg", "card.jpg")}`,
  );
  assert.ok(reader && card);
  assert.equal(createHash("sha256").update(reader).digest("hex"), stored.hash);
  const cardMetadata = await sharp(card).metadata();
  assert.equal(cardMetadata.width, 384);
  assert.equal(cardMetadata.height, 288);
  assert.equal(cardMetadata.format, "jpeg");
  assert.ok(card.length < reader.length);
  const again = await uploadContentImage({
    contentType: "bill",
    contentId: "test-id",
    data,
  });
  assert.deepEqual(again, stored);
  assert.equal(objects.size, 2);

  const small = await sharp({
    create: { width: 160, height: 240, channels: 3, background: "#aa9977" },
  })
    .png()
    .toBuffer();
  const smallStored = await uploadContentImage({
    contentType: "court_case",
    contentId: "small",
    data: small,
  });
  assert.equal(smallStored.width, 160);
  assert.equal(smallStored.height, 240);
  const smallCard = objects.get(
    `/storage/v1/object/content-images/${smallStored.path.replace("reader.jpg", "card.jpg")}`,
  );
  assert.ok(smallCard);
  assert.equal((await sharp(smallCard).metadata()).width, 160);

  corrupt = true;
  await assert.rejects(
    uploadContentImage({ contentType: "bill", contentId: "corrupt", data }),
    /checksum mismatch/,
  );
  corrupt = false;
  failReader = true;
  await assert.rejects(
    uploadContentImage({ contentType: "bill", contentId: "failed", data }),
    /upload failed \(503\)/,
  );
});
