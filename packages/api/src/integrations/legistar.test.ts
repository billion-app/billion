import assert from "node:assert/strict";
import test from "node:test";

import { LegistarClient } from "./legistar";

function requestUrl(input: Parameters<typeof fetch>[0]): URL {
  if (input instanceof URL) return input;
  if (typeof input === "string") return new URL(input);
  return new URL(input.url);
}

void test("paginates list endpoints with explicit top and skip", async () => {
  const urls: URL[] = [];
  const client = new LegistarClient((input) => {
    const url = requestUrl(input);
    urls.push(url);
    const skip = Number(url.searchParams.get("$skip"));
    const rows =
      skip === 0
        ? Array.from({ length: 1000 }, (_, index) => ({ BodyId: index + 1 }))
        : [{ BodyId: 1001 }];
    return Promise.resolve(Response.json(rows));
  });

  const bodies = await client.getBodies("sanjose");

  assert.equal(bodies.length, 1001);
  assert.equal(urls.length, 2);
  const [first, second] = urls;
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.searchParams.get("$top"), "1000");
  assert.equal(first.searchParams.get("$skip"), "0");
  assert.equal(second.searchParams.get("$skip"), "1000");
});

void test("escapes apostrophes in OData filters", async () => {
  let requested: URL | undefined;
  const client = new LegistarClient((input) => {
    requested = requestUrl(input);
    return Promise.resolve(Response.json([]));
  });

  await client.getLegislation("sanjose", { text: "resident's street" });

  assert.ok(requested);
  const filter = requested.searchParams.get("$filter");
  assert.ok(filter);
  assert.match(filter, /resident''s street/);
});

void test("requests complete agenda-item evidence fields", async () => {
  let requested: URL | undefined;
  const client = new LegistarClient((input) => {
    requested = requestUrl(input);
    return Promise.resolve(Response.json([]));
  });

  await client.getAgendaItems("sanjose", 42);

  assert.ok(requested);
  assert.equal(requested.pathname, "/v1/sanjose/Events/42/EventItems");
  assert.equal(requested.searchParams.get("AgendaNote"), "1");
  assert.equal(requested.searchParams.get("MinutesNote"), "1");
  assert.equal(requested.searchParams.get("Attachments"), "1");
  assert.equal(requested.searchParams.get("RollCalls"), "1");
});
