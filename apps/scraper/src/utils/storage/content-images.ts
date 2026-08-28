import { createHash } from "node:crypto";

import {
  CONTENT_IMAGE_BUCKET,
  CONTENT_IMAGE_CACHE_SECONDS,
  contentImagePublicUrl,
  supabaseStorageOrigin,
} from "@acme/db/content-images";

function storageSecret(): string {
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error(
      "Image upload requires SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return secret;
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function uploadContentImage(args: {
  contentType: "bill" | "government_content" | "court_case";
  contentId: string;
  data: Buffer;
}): Promise<{ hash: string; path: string }> {
  const origin = supabaseStorageOrigin();
  if (!origin) {
    throw new Error(
      "Could not determine Supabase Storage URL from SUPABASE_URL or POSTGRES_URL",
    );
  }
  const secret = storageSecret();
  const hash = createHash("sha256").update(args.data).digest("hex");
  const path = `content/${args.contentType}/${args.contentId}/${hash}.jpg`;
  const response = await fetch(
    `${origin}/storage/v1/object/${CONTENT_IMAGE_BUCKET}/${encodePath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        "Content-Type": "image/jpeg",
        "Cache-Control": `max-age=${CONTENT_IMAGE_CACHE_SECONDS}`,
        "x-upsert": "true",
      },
      body: args.data,
    },
  );
  if (!response.ok) {
    throw new Error(
      `Storage upload failed (${response.status}): ${(await response.text()).slice(0, 500)}`,
    );
  }

  const publicUrl = contentImagePublicUrl(origin, path);
  if (!publicUrl)
    throw new Error("Could not construct Storage verification URL");
  const verification = await fetch(publicUrl, { cache: "no-store" });
  if (!verification.ok) {
    throw new Error(`Storage verification failed (${verification.status})`);
  }
  const downloadedHash = createHash("sha256")
    .update(Buffer.from(await verification.arrayBuffer()))
    .digest("hex");
  if (downloadedHash !== hash) {
    throw new Error(`Storage checksum mismatch for ${path}`);
  }

  return { hash, path };
}
