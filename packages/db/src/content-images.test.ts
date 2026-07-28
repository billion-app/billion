import assert from "node:assert/strict";
import test from "node:test";

import {
  contentImagePublicUrl,
  resolveContentImageUrl,
} from "./content-images";

void test("source thumbnail wins over generated and legacy images", () => {
  assert.equal(
    resolveContentImageUrl(
      {
        sourceThumbnailUrl: "https://source.example/image.jpg",
        generatedImagePath: "content/bill/id/hash.jpg",
        legacyImageUrl: "/api/content-images/legacy/id",
      },
      "https://project.supabase.co",
    ),
    "https://source.example/image.jpg",
  );
});

void test("generated Storage image is used when source imagery is missing", () => {
  assert.equal(
    resolveContentImageUrl(
      { generatedImagePath: "content/court case/id/a+b.jpg" },
      "https://project.supabase.co/",
    ),
    "https://project.supabase.co/storage/v1/object/public/content-images/content/court%20case/id/a%2Bb.jpg",
  );
});

void test("legacy endpoint is a temporary final fallback", () => {
  assert.equal(
    resolveContentImageUrl(
      { legacyImageUrl: "/api/content-images/legacy/id" },
      undefined,
    ),
    "/api/content-images/legacy/id",
  );
  assert.equal(resolveContentImageUrl({}, undefined), undefined);
});

void test("public URL is absent without Storage configuration", () => {
  assert.equal(
    contentImagePublicUrl(undefined, "content/bill/id/hash.jpg"),
    undefined,
  );
});
