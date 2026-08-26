import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

test("migration journal timestamps increase with migration order", async () => {
  const journalUrl = new URL("../drizzle/meta/_journal.json", import.meta.url);
  const journal = JSON.parse(await readFile(journalUrl, "utf8")) as {
    entries: JournalEntry[];
  };

  for (let index = 1; index < journal.entries.length; index += 1) {
    const previous = journal.entries[index - 1];
    const current = journal.entries[index];

    assert.ok(previous);
    assert.ok(current);
    assert.equal(current.idx, previous.idx + 1);
    assert.ok(
      current.when > previous.when,
      `${current.tag} must be newer than ${previous.tag}`,
    );
  }
});
