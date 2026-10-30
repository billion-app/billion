import assert from "node:assert/strict";
import test from "node:test";

import type { ResearchSource } from "@acme/validators";
import { candidateResearchCollectionSchema } from "@acme/validators";

import type { SourceFetcher } from "./collect.js";
import { hash } from "./sources.js";
import {
  collectLieutenantGovernor,
  statewideMembers,
  statewideUrls,
} from "./statewide.js";

const fixture = {
  roster:
    "November 3, 2026\nLieutenant Governor\nFiona Ma Democratic\nState Treasurer/CPA\nGloria Romero Republican\nEducator/Businesswoman\nSecretary of State\nAnother Candidate Democratic",
  identifiers:
    "[C|CAS|4|030000000000|3550||Ma|Fiona||01|Fiona Ma|]\r\n[C|CAS|5|030000000000|3652||Romero|Gloria||02|Gloria Romero|]",
  statements:
    "November 3, 2026 Lieutenant Governor Candidate Statements Fiona Ma | DEMOCRATIC As Lieutenant Governor, I will make higher education more affordable, expand paid internships, and strengthen career pathways. Gloria Romero | REPUBLICAN I will restore education standards, develop a bold economic plan that helps businesses thrive, rein in politicized commissions that have failed to protect our water, farmland, and way of life, defend Title IX for our daughters in sports, and fight antisemitism on our campuses. Back to the Top",
  powers:
    "The Lieutenant Governor serves as a voting member of the Board of Regents of the University of California, the Board of Trustees of the California State University system, and the Board of Governors of the California Community Colleges system. The Lieutenant Governor is also President of the Senate and votes in case of a tie. The Lieutenant Governor also serves on and rotates with the State Controller as chair of the three-member State Lands Commission. The Lieutenant Governor chairs the California Commission for Economic Development.",
  finance:
    "Only electronically-reported, state-level, campaign contribution and independent expenditure data is provided through Power Search at this time.",
  fionaBackground:
    "Fiona Ma, CPA is California’s 34th State Treasurer. She was reelected on November 8, 2022.",
  gloriaBackground:
    "Assemblywoman Gloria Romero was successful in March of 2001 in filling the vacancy of Hilda Solis. When Gloria Romero was elected to the Senate, she was elected to replace Edward Vincent on Senate Rules Committee.",
};
const snapshot = (text: string): ResearchSource => ({
  id: "fixture",
  text,
  url: "https://example.test/fixture",
  format: "text",
  publisher: "Offline test fixture",
  fetchedAt: "2026-10-30T12:00:00.000Z",
  contentHash: hash(text),
});
const fetcher =
  (
    changes: Partial<typeof fixture> = {},
    requested: string[] = [],
  ): SourceFetcher =>
  async (id, url, publisher, format) => {
    requested.push(url);
    const key = Object.entries(statewideUrls).find(
      ([, value]) => value === url,
    )?.[0] as keyof typeof fixture | undefined;
    if (!key) throw new Error("Unexpected fixture request");
    return {
      ...snapshot({ ...fixture, ...changes }[key]),
      id,
      url,
      publisher,
      format,
    };
  };

void test("offline collection retains the complete certified race, exact evidence and missing state money", async () => {
  const requested: string[] = [];
  const collection = await collectLieutenantGovernor(fetcher({}, requested));
  assert.equal(requested.length, 7);
  assert.ok(requested.every((url) => !url.includes("fec.gov")));
  assert.deepEqual(
    collection.manifest.members.map((member) => [
      member.name,
      member.candidateId,
    ]),
    [
      ["Fiona Ma", "ca-sos:2026-11-03:030000000000:3550"],
      ["Gloria Romero", "ca-sos:2026-11-03:030000000000:3652"],
    ],
  );
  assert.equal(collection.manifest.policyVersion, "pending");
  assert.equal(
    Date.parse(collection.manifest.expiresAt) -
      Date.parse(collection.manifest.sourceCheckedAt),
    86_400_000,
  );
  for (const brief of collection.briefs) {
    assert.equal(brief.research?.promises.length, 1);
    assert.equal(brief.research?.finance, null);
    assert.equal(
      brief.sections
        .find((section) => section.topic === "record")
        ?.claims.filter((claim) => claim.id.startsWith("background-")).length,
      2,
    );
    assert.ok(
      brief.evidence
        .filter((entry) => entry.id.startsWith("background-"))
        .every((entry) => entry.origin === "primary_record"),
    );
    assert.match(brief.research!.financeGap!, /not zero dollars/);
    for (const entry of brief.evidence)
      assert.ok(
        collection.sources.some(
          (source) =>
            source.contentHash === hash(source.text) &&
            source.contentHash === entry.contentHash &&
            source.text.includes(entry.excerpt),
        ),
      );
  }
});

void test("changed, partial or duplicate official rosters fail closed", () => {
  for (const [roster, identifiers] of [
    [
      fixture.roster.replace("November 3, 2026", "June 2, 2026"),
      fixture.identifiers,
    ],
    [fixture.roster, fixture.identifiers.split("\r\n")[0]!],
    [fixture.roster, fixture.identifiers.replace("3652", "9999")],
    [
      fixture.roster,
      fixture.identifiers.replace("Gloria Romero", "Other Person"),
    ],
    [
      fixture.roster,
      fixture.identifiers.split("\r\n")[0] +
        "\r\n" +
        fixture.identifiers.split("\r\n")[0],
    ],
    [
      fixture.roster.replace(
        "Gloria Romero Republican\nEducator/Businesswoman\n",
        "",
      ),
      fixture.identifiers,
    ],
  ])
    assert.throws(() =>
      statewideMembers(snapshot(roster!), snapshot(identifiers!)),
    );
});

void test("a certified candidate without a statement remains in the collection with explicit gaps", async () => {
  const collection = await collectLieutenantGovernor(
    fetcher({
      statements: fixture.statements.slice(
        0,
        fixture.statements.indexOf("Gloria Romero |"),
      ),
    }),
  );
  assert.equal(collection.briefs.length, 2);
  const missing = collection.briefs[1]!;
  assert.equal(missing.research?.promises.length, 0);
  assert.equal(missing.research?.headlineClaimId, "authority");
  assert.match(missing.sections[0]!.missingEvidence!, /No candidate statement/);
  assert.ok(!missing.evidence.some((entry) => entry.id === "platform"));
});

void test("changed quotes, election pages, corrupt hashes and incomplete collection coverage are rejected", async () => {
  await assert.rejects(
    collectLieutenantGovernor(
      fetcher({
        fionaBackground: fixture.fionaBackground.replaceAll(
          "Fiona Ma",
          "Other Person",
        ),
      }),
    ),
    /background identity changed/,
  );
  await assert.rejects(
    collectLieutenantGovernor(
      fetcher({
        gloriaBackground: fixture.gloriaBackground.replace(
          "March of 2001",
          "March of 2002",
        ),
      }),
    ),
    /Quote missing/,
  );
  await assert.rejects(
    collectLieutenantGovernor(async () => {
      throw new Error("Official source unavailable");
    }),
    /Official source unavailable/,
  );
  await assert.rejects(
    collectLieutenantGovernor(
      fetcher({
        statements: fixture.statements.replace(
          "expand paid internships",
          "change internships",
        ),
      }),
    ),
    /pledge changed/,
  );
  await assert.rejects(
    collectLieutenantGovernor(
      fetcher({ statements: fixture.statements.replace("2026", "2022") }),
    ),
    /Wrong statewide statement/,
  );
  const valid = fetcher();
  await assert.rejects(
    collectLieutenantGovernor(async (...args) => ({
      ...(await valid(...args)),
      contentHash: "0".repeat(64),
    })),
    /Invalid source hash/,
  );
  const collection = await collectLieutenantGovernor(fetcher());
  assert.equal(
    candidateResearchCollectionSchema.safeParse({
      ...collection,
      briefs: collection.briefs.slice(0, 1),
    }).success,
    false,
  );
  collection.briefs[0]!.evidence[0]!.excerpt = "An invented source excerpt";
  assert.equal(
    candidateResearchCollectionSchema.safeParse(collection).success,
    false,
  );
});
