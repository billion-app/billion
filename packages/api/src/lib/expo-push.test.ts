import assert from "node:assert/strict";
import test from "node:test";

import { getExpoPushReceipts, sendExpoPushMessages } from "./expo-push";

void test("sends messages in batches and preserves token-to-ticket mapping", async () => {
  const requestSizes: number[] = [];
  const mockFetch = ((_url: string, init?: RequestInit) => {
    if (typeof init?.body !== "string") {
      throw new Error("Expected a JSON request body");
    }
    const body = JSON.parse(init.body) as { to: string }[];
    requestSizes.push(body.length);
    return Promise.resolve(
      Response.json({
        data: body.map((_, index) => ({
          status: "ok",
          id: `ticket-${requestSizes.length}-${index}`,
        })),
      }),
    );
  }) as typeof fetch;

  const messages = Array.from({ length: 101 }, (_, index) => ({
    to: `ExpoPushToken[token-${index}]`,
    title: "BREAKING",
    body: "A bill changed",
  }));

  const results = await sendExpoPushMessages(messages, mockFetch);
  const lastResult = results.at(100);

  assert.deepEqual(requestSizes, [100, 1]);
  assert.equal(results.length, 101);
  assert.ok(lastResult);
  assert.equal(lastResult.token, "ExpoPushToken[token-100]");
  assert.deepEqual(lastResult.ticket, {
    status: "ok",
    id: "ticket-2-0",
  });
});

void test("reads receipts and retains Expo delivery errors", async () => {
  const mockFetch = (() =>
    Promise.resolve(
      Response.json({
        data: {
          delivered: { status: "ok" },
          uninstalled: {
            status: "error",
            message: "The device is not registered",
            details: { error: "DeviceNotRegistered" },
          },
        },
      }),
    )) as typeof fetch;

  const receipts = await getExpoPushReceipts(
    ["delivered", "uninstalled"],
    mockFetch,
  );

  assert.deepEqual(receipts.delivered, { status: "ok" });
  assert.deepEqual(receipts.uninstalled, {
    status: "error",
    message: "The device is not registered",
    details: { error: "DeviceNotRegistered" },
  });
});

void test("rejects a malformed Expo response", async () => {
  const mockFetch = (() =>
    Promise.resolve(Response.json({ unexpected: true }))) as typeof fetch;

  await assert.rejects(
    sendExpoPushMessages(
      [
        {
          to: "ExpoPushToken[token]",
          title: "BREAKING",
          body: "A bill changed",
        },
      ],
      mockFetch,
    ),
    /invalid push ticket response/,
  );
});
