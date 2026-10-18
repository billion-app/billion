import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

import {
  articleTranslationState,
  translationCachePolicy,
} from "./translation-cache";

void test("a new English revision fetches a new translation", async () => {
  const client = new QueryClient();
  let calls = 0;
  const options = (sourceHash: string) => ({
    queryKey: [
      "content",
      "getTranslation",
      { id: "article", language: "es", sourceHash },
    ],
    queryFn: () => {
      calls++;
      return Promise.resolve({ status: "translated", sourceHash });
    },
    ...translationCachePolicy,
  });
  const observer = new QueryObserver(client, options("old"));
  const unsubscribe = observer.subscribe(() => undefined);
  try {
    await observer.refetch({ cancelRefetch: false });
    observer.setOptions(options("new"));
    await observer.refetch({ cancelRefetch: false });
    assert.equal(observer.getCurrentResult().data?.sourceHash, "new");
    assert.equal(calls, 2);
  } finally {
    unsubscribe();
    client.clear();
  }
});

void test("unavailable translations retry when reopened after recovery", async () => {
  const client = new QueryClient();
  let available = false;
  let calls = 0;
  const options = {
    queryKey: [
      "content",
      "getTranslation",
      { id: "article", language: "es", sourceHash: "same" },
    ],
    queryFn: () => {
      calls++;
      return Promise.resolve({
        status: available ? "translated" : "unavailable",
      });
    },
    ...translationCachePolicy,
  };
  await client.fetchQuery(options);
  available = true;
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => undefined);
  try {
    await observer.refetch({ cancelRefetch: false });
    assert.equal(observer.getCurrentResult().data?.status, "translated");
    assert.equal(calls, 2);
    assert.equal(
      translationCachePolicy.refetchInterval({
        state: { data: { status: "unavailable" } },
      }),
      3_000,
    );
  } finally {
    unsubscribe();
    client.clear();
  }
});

void test("queued translations keep polling until ready", () => {
  assert.equal(
    translationCachePolicy.refetchInterval({
      state: { data: { status: "pending" } },
    }),
    3_000,
  );
  assert.equal(
    translationCachePolicy.refetchInterval({
      state: { data: { status: "translated" } },
    }),
    false,
  );
});

void test("article loading stays visible between polls and through source refresh", () => {
  for (const status of ["pending", "unavailable", "stale"]) {
    assert.equal(
      articleTranslationState(true, false, {
        isError: false,
        isFetching: false,
        data: { status },
      }),
      "pending",
    );
  }
});
void test("a displayed translation does not flash loading during a background fetch", () => {
  assert.equal(
    articleTranslationState(true, true, {
      isError: false,
      isFetching: true,
      data: { status: "translated" },
    }),
    "translated",
  );
});
void test("article errors offer retry; English never looks like a pending translation", () => {
  assert.equal(
    articleTranslationState(true, false, { isError: true, isFetching: false }),
    "unavailable",
  );
  assert.equal(
    articleTranslationState(false, false, {
      isError: false,
      isFetching: false,
    }),
    "original",
  );
});
