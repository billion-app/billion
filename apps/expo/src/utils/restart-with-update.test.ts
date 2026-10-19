import assert from "node:assert/strict";
import test from "node:test";

import { restartWithLatestUpdate } from "./restart-with-update";

void test("restart skips the cached intermediate update and waits for the latest download", async () => {
  let cached = "intermediate";
  let launched: string | undefined;
  let finishDownload: (() => void) | undefined;
  const download = new Promise<void>((resolve) => {
    finishDownload = resolve;
  });
  const restart = restartWithLatestUpdate({
    fetchUpdateAsync: async () => {
      await download;
      cached = "latest";
      return { isNew: true, isRollBackToEmbedded: false };
    },
    reloadAsync: () => {
      launched = cached;
      return Promise.resolve();
    },
  });

  assert.equal(launched, undefined, "must not reload while downloading");
  finishDownload?.();
  await restart;
  assert.equal(launched, "latest");
});

void test("a stale prompt does not restart when the server has no update", async () => {
  let reloads = 0;
  await restartWithLatestUpdate({
    fetchUpdateAsync: () =>
      Promise.resolve({
        isNew: false,
        isRollBackToEmbedded: false,
      }),
    reloadAsync: () => {
      reloads++;
      return Promise.resolve();
    },
  });
  assert.equal(reloads, 0);
});

void test("a rollback to the embedded bundle still restarts", async () => {
  let reloads = 0;
  await restartWithLatestUpdate({
    fetchUpdateAsync: () =>
      Promise.resolve({
        isNew: false,
        isRollBackToEmbedded: true,
      }),
    reloadAsync: () => {
      reloads++;
      return Promise.resolve();
    },
  });
  assert.equal(reloads, 1);
});

void test("a failed download never restarts into the intermediate cached update", async () => {
  let reloads = 0;
  const failure = new Error("offline");
  await assert.rejects(
    restartWithLatestUpdate({
      fetchUpdateAsync: () => Promise.reject(failure),
      reloadAsync: () => {
        reloads++;
        return Promise.resolve();
      },
    }),
    failure,
  );
  assert.equal(reloads, 0);
});

void test("a reload failure reaches the caller so the reader can retry", async () => {
  const failure = new Error("reload failed");
  await assert.rejects(
    restartWithLatestUpdate({
      fetchUpdateAsync: () =>
        Promise.resolve({
          isNew: true,
          isRollBackToEmbedded: false,
        }),
      reloadAsync: () => Promise.reject(failure),
    }),
    failure,
  );
});
