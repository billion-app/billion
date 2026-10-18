import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

interface AddressHook {
  setAddress: (address: string) => Promise<void>;
  clearAddress: () => Promise<void>;
}
interface MountedHook {
  state: unknown[];
  cleanup?: () => void;
}

/** Run the real hook with controlled storage completion and minimal React hooks. */
function harness() {
  const source = readFileSync(
    new URL("./useUserAddress.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const reads: ((address: string | null) => void)[] = [];
  let stored: string | null = "old address";
  let current: MountedHook = { state: [] };
  const react = {
    useState(value: unknown) {
      const owner = current;
      const index = owner.state.length;
      owner.state.push(value);
      return [
        value,
        (next: unknown) => {
          owner.state[index] = next;
        },
      ];
    },
    useEffect(effect: () => () => void) {
      current.cleanup = effect();
    },
    useCallback(callback: unknown) {
      return callback;
    },
  };
  const sessionStorage = {
    getItemAsync: () =>
      new Promise<string | null>((resolve) => {
        reads.push(resolve);
      }),
    setItemAsync: (_key: string, value: string) => {
      stored = value;
      return Promise.resolve();
    },
    deleteItemAsync: () => {
      stored = null;
      return Promise.resolve();
    },
  };
  const exported = {} as { useUserAddress: () => AddressHook };
  runInNewContext(outputText, {
    exports: exported,
    require: (name: string) => {
      if (name === "react") return react;
      if (name === "~/utils/client-storage") return { sessionStorage };
      throw new Error(`Unexpected hook dependency: ${name}`);
    },
  });
  return {
    mount() {
      current = { state: [] };
      const mounted = current;
      return { ...exported.useUserAddress(), mounted };
    },
    async finishRead(index: number, value: string | null) {
      assert.ok(reads[index]);
      reads[index](value);
      await Promise.resolve();
      await Promise.resolve();
    },
    stored: () => stored,
  };
}

test("a delayed initial read cannot replace a newer address from another screen", async () => {
  const app = harness();
  const editor = app.mount();
  await app.finishRead(0, "old address");
  const reader = app.mount();
  await editor.setAddress("new address");
  await app.finishRead(1, "old address");
  assert.equal(app.stored(), "new address");
  assert.deepEqual(reader.mounted.state, ["new address", false]);
});

test("a delayed initial read cannot restore an address cleared on another screen", async () => {
  const app = harness();
  const editor = app.mount();
  await app.finishRead(0, "old address");
  const reader = app.mount();
  await editor.clearAddress();
  await app.finishRead(1, "old address");
  assert.equal(app.stored(), null);
  assert.deepEqual(reader.mounted.state, [null, false]);
});

test("mounted readers follow writes and removals, while unmounted readers unsubscribe", async () => {
  const app = harness();
  const editor = app.mount();
  const reader = app.mount();
  await app.finishRead(0, "old address");
  await app.finishRead(1, "old address");
  await editor.setAddress("new address");
  assert.deepEqual(reader.mounted.state, ["new address", false]);
  await editor.clearAddress();
  assert.deepEqual(reader.mounted.state, [null, false]);
  reader.mounted.cleanup?.();
  await editor.setAddress("third address");
  assert.deepEqual(reader.mounted.state, [null, false]);
});

test("a completed save updates remaining readers after the editor unmounts", async () => {
  const app = harness();
  const editor = app.mount();
  const reader = app.mount();
  await app.finishRead(0, "old address");
  await app.finishRead(1, "old address");
  const save = editor.setAddress("new address");
  editor.mounted.cleanup?.();
  await save;
  assert.deepEqual(editor.mounted.state, ["old address", false]);
  assert.deepEqual(reader.mounted.state, ["new address", false]);
});
