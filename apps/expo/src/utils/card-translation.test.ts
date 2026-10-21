import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

import type { CardTranslationData } from "./card-translation";
import {
  cardTranslationDelay,
  cardTranslationState,
  cardTranslationWait,
  pendingCardTranslations,
  pollCardTranslations,
} from "./card-translation";

const lookup = {
  contentId: "card-a",
  sourceHash: "revision-a",
  fields: ["card.title" as const],
};
const otherLookup = {
  contentId: "card-b",
  sourceHash: "revision-b",
  fields: ["card.title" as const],
};

void test("array, saved and infinite feeds deduplicate pending lookup revisions", () => {
  const items = [
    { translationState: "translated" as const },
    { translationState: "pending" as const, translationLookup: lookup },
    { translationState: "pending" as const, translationLookup: lookup },
  ];
  for (const data of [
    items,
    { items },
    { sponsoredBills: items },
    { pages: [{ items }, { items }] },
  ])
    assert.deepEqual(pendingCardTranslations(data), [lookup]);
  assert.deepEqual(pendingCardTranslations(undefined), []);
});

void test("queued cards only read readiness; partial completion refreshes once per change", async () => {
  let now = 0;
  let polls = 0;
  let refreshes = 0;
  const waits: number[] = [];
  const result = await pollCardTranslations({
    lookups: [lookup, otherLookup],
    deadline: 120_000,
    signal: new AbortController().signal,
    now: () => now,
    ready: () => {
      polls++;
      if (polls < 3) {
        assert.equal(refreshes, 0);
        return Promise.resolve([]);
      }
      return Promise.resolve(polls < 5 ? [lookup] : [lookup, otherLookup]);
    },
    refresh: () => {
      refreshes++;
      return Promise.resolve({ data: [] });
    },
    wait: (ms) => {
      now += ms;
      waits.push(ms);
      return Promise.resolve();
    },
  });
  assert.equal(result, "ready");
  assert.equal(refreshes, 2);
  assert.deepEqual(waits, [3000, 6000, 12000, 15000]);
});

void test("unavailable workers and network errors stop at two minutes without feed reads", async () => {
  for (const networkError of [false, true]) {
    let now = 0;
    let refreshes = 0;
    const waits: number[] = [];
    assert.equal(
      await pollCardTranslations({
        lookups: [lookup],
        deadline: 120_000,
        signal: new AbortController().signal,
        now: () => now,
        ready: () =>
          networkError
            ? Promise.reject(new Error("offline"))
            : Promise.resolve([]),
        refresh: () => {
          refreshes++;
          return Promise.resolve({ data: [] });
        },
        wait: (ms) => {
          now += ms;
          waits.push(ms);
          return Promise.resolve();
        },
      }),
      "expired",
    );
    assert.equal(refreshes, 0);
    assert.equal(now, 120_000);
    assert.ok(waits.every((ms) => ms <= 15_000));
  }
});

void test("readiness from an older source cannot refresh a changed revision", async () => {
  let now = 0;
  let refreshes = 0;
  assert.equal(
    await pollCardTranslations({
      lookups: [{ ...lookup, sourceHash: "new-source" }],
      deadline: 3000,
      signal: new AbortController().signal,
      now: () => now,
      ready: () => Promise.resolve([lookup]),
      refresh: () => {
        refreshes++;
        return Promise.resolve({ data: [] });
      },
      wait: (ms) => {
        now += ms;
        return Promise.resolve();
      },
    }),
    "expired",
  );
  assert.equal(refreshes, 0);
});

void test("partial completion preserves the deadline; source, language and explicit retry get a fresh wait", () => {
  const initial = cardTranslationWait(null, "es", [lookup, otherLookup], 0);
  assert.equal(cardTranslationWait(initial, "es", [lookup], 60_000), initial);
  assert.equal(
    cardTranslationWait(initial, "zh", [lookup], 60_000).deadline,
    180_000,
  );
  assert.equal(
    cardTranslationWait(
      initial,
      "es",
      [{ ...lookup, sourceHash: "new" }],
      60_000,
    ).deadline,
    180_000,
  );
  assert.equal(
    cardTranslationWait(null, "es", [lookup], 60_000).deadline,
    180_000,
  );
  assert.equal(cardTranslationDelay(100), 15_000);
});

void test("changing language cancels in-flight readiness before it can refresh the old feed", async () => {
  const controller = new AbortController();
  let refreshes = 0;
  assert.equal(
    await pollCardTranslations({
      lookups: [lookup],
      deadline: 120_000,
      signal: controller.signal,
      now: () => 0,
      ready: () => {
        controller.abort();
        return Promise.resolve([lookup]);
      },
      refresh: () => {
        refreshes++;
        return Promise.resolve({ data: [] });
      },
      wait: () => Promise.resolve(),
    }),
    "cancelled",
  );
  assert.equal(refreshes, 0);
});

void test("large infinite feeds use bounded readiness batches and one refresh", async () => {
  const lookups = Array.from({ length: 230 }, (_, i) => ({
    contentId: `card-${i}`,
    sourceHash: "revision",
    fields: ["card.title" as const],
  }));
  const batches: number[] = [];
  let refreshes = 0;
  assert.equal(
    await pollCardTranslations({
      lookups,
      deadline: 120_000,
      signal: new AbortController().signal,
      now: () => 0,
      ready: (batch) => {
        batches.push(batch.length);
        return Promise.resolve(batch);
      },
      refresh: () => {
        refreshes++;
        return Promise.resolve({ data: [] });
      },
      wait: () => Promise.resolve(),
    }),
    "ready",
  );
  assert.deepEqual(batches, [100, 100, 30]);
  assert.equal(refreshes, 1);
});

void test("the notice never implies an English fallback is translated", () => {
  assert.equal(cardTranslationState([{}], "zh"), "pending");
  assert.equal(
    cardTranslationState(
      [{ translationState: "translated" }, { translationState: "pending" }],
      "es",
    ),
    "pending",
  );
  assert.equal(
    cardTranslationState([{ translationState: "unavailable" }], "zh"),
    "unavailable",
  );
  assert.equal(
    cardTranslationState([{ translationState: "translated" }], "zh"),
    "translated",
  );
  assert.equal(
    cardTranslationState([{ translationState: "pending" }], "en"),
    "original",
  );
  assert.equal(cardTranslationState([], "zh"), "original");
});

void test("network failure offers retry without hiding an already complete cached translation", () => {
  assert.equal(
    cardTranslationState([{ translationState: "pending" }], "zh", true),
    "unavailable",
  );
  assert.equal(
    cardTranslationState([{ translationState: "translated" }], "zh", true),
    "translated",
  );
});

void test("a real QueryObserver retries failed and still-pending refreshes until translated data arrives", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let requests = 0;
  const pending: CardTranslationData = [
    { translationState: "pending", translationLookup: lookup },
  ];
  const observer = new QueryObserver<CardTranslationData>(client, {
    queryKey: ["translation-refresh"],
    initialData: pending,
    queryFn: () => {
      requests++;
      if (requests === 1) return Promise.reject(new Error("offline"));
      return Promise.resolve<CardTranslationData>(
        requests === 2 ? pending : [{ translationState: "translated" }],
      );
    },
  });
  let now = 0;
  try {
    const result = await pollCardTranslations({
      lookups: [lookup],
      deadline: 120_000,
      signal: new AbortController().signal,
      ready: () => Promise.resolve([lookup]),
      refresh: (options) => observer.refetch(options),
      now: () => now,
      wait: (ms) => {
        assert.deepEqual(observer.getCurrentResult().data, pending);
        now += ms;
        return Promise.resolve();
      },
    });
    assert.equal(result, "ready");
    assert.equal(requests, 3);
    assert.equal(now, 9000);
    assert.equal(observer.getCurrentResult().isError, false);
  } finally {
    observer.destroy();
    client.clear();
  }
});

void test("a real QueryObserver with ready status but a stale feed expires at the original deadline", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const pending: CardTranslationData = [
    { translationState: "pending", translationLookup: lookup },
  ];
  const observer = new QueryObserver<CardTranslationData>(client, {
    queryKey: ["stale-translation-refresh"],
    initialData: pending,
    queryFn: () => Promise.resolve(pending),
  });
  let now = 0;
  try {
    assert.equal(
      await pollCardTranslations({
        lookups: [lookup],
        deadline: 120_000,
        signal: new AbortController().signal,
        ready: () => Promise.resolve([lookup]),
        refresh: (options) => observer.refetch(options),
        now: () => now,
        wait: (ms) => {
          now += ms;
          return Promise.resolve();
        },
      }),
      "expired",
    );
    assert.equal(now, 120_000);
  } finally {
    observer.destroy();
    client.clear();
  }
});
