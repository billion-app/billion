import assert from "node:assert/strict";
import test from "node:test";

import { createTrpcConsole } from "./trpc-logging";

test("tRPC transport errors stay in logs instead of opening native LogBox", () => {
  const calls: string[] = [];
  const sink = {
    log: () => calls.push("log"),
    error: () => calls.push("error"),
  };

  createTrpcConsole(sink).error("request failed");

  assert.deepEqual(calls, ["log"]);
});
