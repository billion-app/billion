import assert from "node:assert/strict";
import test from "node:test";

import { afterReaderPaint } from "./reader-ready";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("reader readiness waits for stylesheet, font layout and a painted frame", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stylesheet = deferred();
  const fonts = deferred();
  const frames: (() => void)[] = [];
  const events: string[] = [];
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const oldFrame = Object.getOwnPropertyDescriptor(
    globalThis,
    "requestAnimationFrame",
  );
  const fontSet = {
    get ready() {
      events.push("fonts");
      return fonts.promise;
    },
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: {
        getBoundingClientRect() {
          events.push("layout");
        },
      },
      fonts: fontSet,
    },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (frame: () => void) => frames.push(frame),
  });
  try {
    const controller = new AbortController();
    const pending = afterReaderPaint(
      stylesheet.promise,
      controller.signal,
      () => events.push("ready"),
      () => events.push("fallback"),
    );
    assert.deepEqual([...events], []);
    stylesheet.resolve();
    await Promise.resolve();
    assert.deepEqual([...events], ["layout", "fonts"]);
    assert.equal(frames.length, 0);
    fonts.resolve();
    await pending;
    assert.equal(frames.length, 1);
    const first = frames.shift();
    assert.ok(first);
    first();
    assert.ok(
      !events.includes("ready"),
      "a requestAnimationFrame callback runs before paint",
    );
    const second = frames.shift();
    assert.ok(second);
    second();
    assert.deepEqual([...events], ["layout", "fonts", "layout", "ready"]);

    // Leaving before either font completion or the reveal must never uncover a stale reader.
    for (const stage of ["stylesheet", "fonts", "frame"] as const) {
      events.length = 0;
      const next = new AbortController();
      const css = deferred();
      const ready = afterReaderPaint(
        css.promise,
        next.signal,
        () => events.push("ready"),
        () => events.push("fallback"),
      );
      if (stage === "stylesheet") next.abort();
      css.resolve();
      await Promise.resolve();
      if (stage === "fonts") next.abort();
      await ready;
      if (stage === "frame") next.abort();
      for (const frame of frames.splice(0)) frame();
      assert.ok(!events.includes("ready"), `unmounted during ${stage}`);
    }
    // A blackholed font host must yield stable fallback typography, not an
    // indefinite skeleton or a late font swap after the reader is visible.
    for (const stage of ["stylesheet", "fonts"] as const) {
      events.length = 0;
      const stalled = deferred();
      Object.defineProperty(fontSet, "ready", {
        configurable: true,
        value: stage === "fonts" ? stalled.promise : Promise.resolve(),
      });
      const ready = afterReaderPaint(
        stage === "stylesheet" ? stalled.promise : Promise.resolve(),
        new AbortController().signal,
        () => events.push("ready"),
        () => events.push("fallback"),
      );
      await Promise.resolve();
      t.mock.timers.tick(2000);
      await ready;
      assert.ok(events.includes("fallback"), stage);
      const first = frames.shift();
      assert.ok(first);
      first();
      const second = frames.shift();
      assert.ok(second);
      second();
      assert.equal(events.at(-1), "ready");
      stalled.resolve();
      await Promise.resolve();
      assert.equal(events.filter((event) => event === "ready").length, 1);
    }
  } finally {
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
    if (oldFrame)
      Object.defineProperty(globalThis, "requestAnimationFrame", oldFrame);
    else Reflect.deleteProperty(globalThis, "requestAnimationFrame");
  }
});
