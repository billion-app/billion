import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { formatPlacemark } from "../utils/address";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function harness() {
  const fix = deferred<{
    coords: { latitude: number; longitude: number };
  } | null>();
  const geocode = deferred<Parameters<typeof formatPlacemark>[0][]>();
  const state: unknown[] = [];
  let cleanup: (() => void) | undefined;
  let geocodeCalls = 0;
  const react = {
    useState(initial: unknown) {
      const index = state.length;
      state.push(initial);
      return [
        initial,
        (value: unknown) => {
          state[index] = value;
        },
      ];
    },
    useRef: (initial: unknown) => ({ current: initial }),
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => () => void) => {
      cleanup = effect();
    },
  };
  const source = readFileSync(
    new URL("./useDeviceAddress.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const exported = {} as {
    useDeviceAddress: () => {
      resolve: () => Promise<string | null>;
      cancel: () => void;
    };
  };
  runInNewContext(outputText, {
    exports: exported,
    require: (name: string) => {
      if (name === "react") return react;
      if (name === "expo-location")
        return {
          reverseGeocodeAsync: () => {
            geocodeCalls++;
            return geocode.promise;
          },
        };
      if (name === "~/hooks/useDeviceLocation")
        return {
          useDeviceLocation: () => ({
            request: () => fix.promise,
            locating: false,
            error: null,
          }),
        };
      if (name === "~/utils/address") return { formatPlacemark };
      throw new Error(`Unexpected hook dependency: ${name}`);
    },
  });
  return {
    hook: exported.useDeviceAddress(),
    fix,
    geocode,
    state,
    unmount: () => cleanup?.(),
    geocodeCalls: () => geocodeCalls,
    async finishFix() {
      fix.resolve({ coords: { latitude: 38.5, longitude: -121.5 } });
      await setImmediate();
    },
  };
}

const placemark = {
  streetNumber: "123",
  street: "Oak St",
  city: "Sacramento",
  region: "CA",
  postalCode: "95814",
};

test("manual edit cancels a pending GPS result before reverse geocoding", async () => {
  const app = harness();
  const result = app.hook.resolve();
  app.hook.cancel();
  await app.finishFix();
  assert.equal(await result, null);
  assert.equal(app.geocodeCalls(), 0);
});

for (const invalidate of ["cancel", "unmount"] as const) {
  test(`${invalidate} discards a pending reverse-geocode result`, async () => {
    const app = harness();
    const result = app.hook.resolve();
    await app.finishFix();
    assert.equal(app.geocodeCalls(), 1);
    if (invalidate === "cancel") app.hook.cancel();
    else app.unmount();
    app.geocode.resolve([placemark]);
    assert.equal(await result, null);
  });
}

for (const response of ["empty", "rejected"] as const) {
  test(`${response} reverse geocoding returns an address error, never coordinates`, async () => {
    const app = harness();
    const result = app.hook.resolve();
    await app.finishFix();
    if (response === "empty") app.geocode.resolve([]);
    else app.geocode.reject(new Error("geocoder unavailable"));
    assert.equal(await result, null);
    assert.deepEqual(app.state, [false, "address-unavailable"]);
  });
}

test("a usable native placemark resolves to a street address", async () => {
  const app = harness();
  const result = app.hook.resolve();
  await app.finishFix();
  app.geocode.resolve([placemark]);
  assert.equal(await result, "123 Oak St, Sacramento, CA 95814");
  assert.deepEqual(app.state, [false, null]);
});
