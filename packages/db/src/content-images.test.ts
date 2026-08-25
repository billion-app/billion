import assert from "node:assert/strict";
import test from "node:test";

import {
  contentImagePublicUrl,
  resolveContentImageUrl,
  supabaseStorageOrigin,
} from "./content-images.js";

void test("resolves generated Storage art when a source thumbnail is missing", () => {
  assert.equal(
    resolveContentImageUrl(
      null,
      "content/bill/id with spaces/image.jpg",
      "https://example.supabase.co/",
    ),
    "https://example.supabase.co/storage/v1/object/public/content-images/content/bill/id%20with%20spaces/image.jpg",
  );
});

void test("keeps a source thumbnail ahead of generated art", () => {
  assert.equal(
    resolveContentImageUrl(
      "https://source.example/image.jpg",
      "content/bill/id/image.jpg",
      "https://example.supabase.co",
    ),
    "https://source.example/image.jpg",
  );
});

void test("does not construct a public URL without both origin and path", () => {
  assert.equal(contentImagePublicUrl(undefined, "content/a.jpg"), undefined);
  assert.equal(
    contentImagePublicUrl("https://example.supabase.co", null),
    undefined,
  );
});

void test("derives the Storage origin from direct and pooled Supabase database URLs", () => {
  assert.equal(
    supabaseStorageOrigin(
      undefined,
      "postgresql://postgres:secret@db.abc123.supabase.co:5432/postgres",
    ),
    "https://abc123.supabase.co",
  );
  assert.equal(
    supabaseStorageOrigin(
      undefined,
      "postgresql://postgres.abc123:secret@aws-0-us-west-1.pooler.supabase.com:6543/postgres",
    ),
    "https://abc123.supabase.co",
  );
});
