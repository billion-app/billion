import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { ResearchSource } from "@acme/validators";

import { publicSourceAddresses } from "../research/pages.js";
import {
  CaliforniaBudgetReached,
  californiaLocalAuthority,
  collectCaliforniaEvidence,
  fetchBoundedCaliforniaSource,
  qualifiedCandidatePage,
} from "./california-evidence.js";
import { decodeCaliforniaRoster } from "./california-roster.js";

const now = "2026-10-30T12:00:00.000Z";
const source = (id: string, url: string, text: string): ResearchSource => ({
  id,
  url,
  text,
  publisher: "fixture",
  format: "html",
  contentHash: createHash("sha256").update(text).digest("hex"),
  fetchedAt: now,
});
async function fixture() {
  const bytes = await readFile(
    new URL("./fixtures/C26GG.txt", import.meta.url),
  );
  const text = await readFile(
    new URL("./fixtures/certified-2026.txt", import.meta.url),
    "utf8",
  );
  const snapshot = decodeCaliforniaRoster({
    bytes,
    fetchedAt: now,
    certification: source("cert", "https://example.gov/cert", text),
  });
  const race = snapshot.races[0]!;
  return { snapshot, race };
}
test("official candidate statements preserve candidate origin and exclude opponent section", async () => {
  const { snapshot, race } = await fixture();
  const [first, second] = race.members;
  assert.ok(first && second);
  const sharedSources = new Map<string, Promise<ResearchSource>>();
  let requests = 0;
  const text = `California Governor 2026 ${first.name} I will protect public services and support public schools through a legislative budget proposal. ${"My plan will expand services and reduce unnecessary costs with published progress reports. ".repeat(3)} ${second.name} I oppose the first candidate and will end the first candidate's program.`;
  const result = await collectCaliforniaEvidence(
    { snapshot, race, member: first },
    {
      now: () => now,
      sharedSources,
      budget: {
        request() {
          requests++;
        },
        bytes() {},
      },
      search: async () => ({ sources: [] }),
      fetch: async (id, url) =>
        source(
          id,
          url,
          url.includes("candidates/governor")
            ? text
            : url.includes("contact-list")
              ? "Official contact source with no listed website for this candidate."
              : "The Governor signs legislation, administers state departments and submits the budget proposal to the Legislature.",
        ),
    },
  );
  const evidence = result.evidence.find(
    (e) => e.role === "candidate_statement",
  );
  assert.ok(evidence);
  assert.equal(evidence.origin, "candidate");
  assert.equal(evidence.excerpt.includes(second.name), false);
  assert.equal(result.classification, "supported");
  assert.ok(requests <= 6);
});
test("roster plus office description remains an evidence gap and fetch failures remain failures", async () => {
  const { snapshot, race } = await fixture();
  const result = await collectCaliforniaEvidence(
    { snapshot, race, member: race.members[0]! },
    {
      now: () => now,
      sharedSources: new Map(),
      budget: { request() {}, bytes() {} },
      search: async () => ({ sources: [] }),
      fetch: async (id, url) => {
        if (url.includes("candidates/")) throw new Error("403");
        return source(
          id,
          url,
          "Official office description. The Governor administers departments and signs legislation.",
        );
      },
    },
  );
  assert.equal(result.classification, "evidence_gap");
  assert.ok(
    result.gaps.some(
      (g) => g.code === "source_unavailable" && g.dimension === "priorities",
    ),
  );
  assert.equal(
    result.evidence.some((e) => e.role === "candidate_statement"),
    false,
  );
});
test("unqualified same-name result from another jurisdiction cannot support research", async () => {
  const { race } = await fixture();
  const member = race.members[0]!;
  assert.equal(
    qualifiedCandidatePage(
      source(
        "out",
        "https://example.com",
        `${member.name} Governor of Ohio in 2026. I will support Ohio schools.`,
      ),
      race,
      member.name,
      false,
    ),
    false,
  );
});
test("shared official documents fetch once for separate candidate dossiers", async () => {
  const { snapshot, race } = await fixture();
  let fetched = 0;
  const sharedSources = new Map<string, Promise<ResearchSource>>();
  const deps = {
    now: () => now,
    sharedSources,
    budget: { request() {}, bytes() {} },
    search: async () => ({ sources: [] }),
    fetch: async (id: string, url: string) => {
      fetched++;
      return source(
        id,
        url,
        "Official office source without any candidate-specific platform or record.",
      );
    },
  };
  for (const member of race.members)
    await collectCaliforniaEvidence({ snapshot, race, member }, deps);
  assert.equal(fetched, 3);
});
test("source stream cancels before retaining data over the total byte bound", async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(200));
      },
      cancel() {
        cancelled = true;
      },
    }),
  );
  await assert.rejects(
    () =>
      fetchBoundedCaliforniaSource(
        "source",
        "https://example.com",
        "Government",
        "text",
        {
          request() {},
          bytes() {
            throw new CaliforniaBudgetReached("source bytes");
          },
        },
        undefined,
        {
          addresses: async () => [{ address: "93.184.216.34", family: 4 }],
          transport: async () => response,
        },
      ),
    CaliforniaBudgetReached,
  );
  assert.equal(cancelled, true);
});

test("campaign endorsement of another-race candidate does not truncate its platform", async () => {
  const { snapshot, race } = await fixture();
  const member = race.members[0]!;
  const endorser = snapshot.races[2]!.members[0]!;
  const text = `${member.name} is endorsed by ${endorser.name}. ${"I will protect public services and support public schools through published budget proposals. ".repeat(5)}\nLinked source navigation (discovery only):\nDonate => https://example.com/donate`;
  const result = await collectCaliforniaEvidence(
    { snapshot, race, member },
    {
      now: () => now,
      sharedSources: new Map(),
      budget: { request() {}, bytes() {} },
      search: async () => ({ sources: [] }),
      fetch: async (id, url) =>
        source(
          id,
          url,
          url.includes("contact-list")
            ? `${member.name}\nWEBSITE: www.example.com\n${race.members[1]!.name}`
            : url.includes("www.example.com")
              ? text
              : "Official office powers and constraints.",
        ),
    },
  );
  const entry = result.evidence.find((e) => e.role === "candidate_statement");
  assert.ok(entry);
  assert.ok(entry.excerpt.includes(endorser.name));
  assert.equal(entry.excerpt.includes("Linked source navigation"), false);
  assert.equal(result.classification, "supported");
});

test("judicial same-name record in another appellate district cannot qualify", async () => {
  const { snapshot } = await fixture();
  const race = snapshot.races.find((r) => r.sourceContestId.startsWith("15"))!;
  const name = race.members[0]!.name;
  assert.equal(
    qualifiedCandidatePage(
      source(
        "wrong-court",
        "https://courts.ca.gov/justice",
        `${name} served the California Court of Appeal in the Eighth Appellate District, Division One.`,
      ),
      race,
      name,
      false,
    ),
    false,
  );
});

test("source boundary rejects credentials and private literal addresses before transport", async () => {
  let calls = 0;
  const transport = async () => {
    calls++;
    return new Response("A valid public source document.");
  };
  for (const url of [
    "http://127.0.0.1:10531/v1/models",
    "http://169.254.169.254/latest/meta-data/",
    "https://name:password@example.com/",
  ]) {
    await assert.rejects(() =>
      fetchBoundedCaliforniaSource(
        "source",
        url,
        "Source",
        "text",
        { request() {}, bytes() {} },
        undefined,
        { transport },
      ),
    );
  }
  assert.equal(calls, 0);
});
test("source redirects are revalidated and API keys are stripped on origin change", async () => {
  const headers: Record<string, string>[] = [];
  const addresses = async (url: string) =>
    new URL(url).hostname === "127.0.0.1"
      ? publicSourceAddresses(url)
      : [{ address: "93.184.216.34", family: 4 }];
  let calls = 0;
  await assert.rejects(
    () =>
      fetchBoundedCaliforniaSource(
        "source",
        "https://example.com/",
        "Source",
        "text",
        { request() {}, bytes() {} },
        undefined,
        {
          addresses,
          transport: async () => {
            calls++;
            return new Response(null, {
              status: 302,
              headers: { location: "http://127.0.0.1:10531/v1/models" },
            });
          },
        },
      ),
    /Private source/,
  );
  assert.equal(calls, 1);
  let hop = 0;
  const result = await fetchBoundedCaliforniaSource(
    "source",
    "https://api.open.fec.gov/v1/candidates/",
    "FEC",
    "text",
    { request() {}, bytes() {} },
    "private-key",
    {
      addresses,
      transport: async (_url, _addresses, _signal, provided) => {
        headers.push(provided ?? {});
        return hop++ === 0
          ? new Response(null, {
              status: 302,
              headers: { location: "https://example.com/fec" },
            })
          : new Response("A valid public source document.");
      },
    },
  );
  assert.equal(headers[0]?.["X-Api-Key"], "private-key");
  assert.equal(headers[1]?.["X-Api-Key"], undefined);
  assert.equal(result.url, "https://example.com/fec");
});

test("local authority capabilities keep district college, K12, city, water and trial roles distinct", () => {
  const role = (office: string) =>
    californiaLocalAuthority({ office, jurisdictionLabel: "San José" });
  assert.ok(
    role("San José-Evergreen CCD, Trustee Area 2")?.url.includes("sjeccd.edu"),
  );
  assert.ok(
    role("San José Unified SD, Trustee Area 1")?.url.includes("DBASBulletins"),
  );
  assert.equal(
    role("City of San José Council Member District 1")?.id,
    "san-jose-council",
  );
  assert.equal(
    role("Santa Clara Valley Water District Director District 6")?.id,
    "valley-water-board",
  );
  assert.equal(
    role("Superior Court Judge Office 1")?.officeKind,
    "judicial_election",
  );
  assert.equal(role("Unknown Utility Governing Board"), null);
});
test("verified campaign root follows bounded same-origin platform children even when the child omits the candidate name", async () => {
  const { snapshot, race } = await fixture();
  const member = race.members[0]!;
  const fetched: string[] = [];
  const result = await collectCaliforniaEvidence(
    { snapshot, race, member },
    {
      now: () => now,
      sharedSources: new Map(),
      budget: { request() {}, bytes() {} },
      search: async () => ({ sources: [] }),
      fetch: async (id, url) => {
        fetched.push(url);
        const text = url.includes("contact-list")
          ? `${member.name}\nWEBSITE: www.example.com\n${race.members[1]!.name}`
          : url === "https://www.example.com"
            ? `${member.name}\nLinked source navigation (discovery only):\nIssues => https://www.example.com/issues\nDonate => https://www.example.com/donate`
            : url.endsWith("/issues")
              ? "I will support public schools with published budget proposals and independent progress reports. ".repeat(
                  5,
                )
              : "Official office powers and constitutional responsibilities.";
        return source(id, url, text);
      },
    },
  );
  const issue = result.evidence.find(
    (entry) =>
      entry.role === "candidate_statement" &&
      result.sources
        .find((s) => s.id === entry.sourceId)
        ?.url.endsWith("/issues"),
  );
  assert.ok(issue);
  assert.equal(issue.origin, "candidate");
  assert.ok(
    result.sourceLinks?.some((link) => link.relation === "official_contact"),
  );
  assert.ok(
    result.sourceLinks?.some(
      (link) =>
        link.relation === "same_origin_campaign" &&
        link.url.endsWith("/issues"),
    ),
  );
  assert.equal(
    fetched.some((url) => url.includes("/donate")),
    false,
  );
  assert.ok(fetched.length <= 8);
});

test("candidate names require complete Unicode token boundaries", async () => {
  const { race } = await fixture();
  for (const body of [
    "Steve Hiltonson",
    "Steve Hiltonshire",
    "Esteve Hilton",
  ]) {
    assert.equal(
      qualifiedCandidatePage(
        source(
          "wrong",
          "https://example.com",
          `${body} California Governor 2026 I will support schools.`,
        ),
        race,
        "Steve Hilton",
        true,
      ),
      false,
    );
  }
  assert.equal(
    qualifiedCandidatePage(
      source(
        "right",
        "https://example.com",
        "Steve Hilton, California Governor 2026",
      ),
      race,
      "Steve Hilton",
      true,
    ),
    true,
  );
});
test("unknown campaign and party discovery cannot masquerade as independent reporting", async () => {
  const { snapshot, race } = await fixture();
  const member = race.members[0]!;
  const result = await collectCaliforniaEvidence(
    { snapshot, race, member },
    {
      now: () => now,
      sharedSources: new Map(),
      budget: { request() {}, bytes() {} },
      search: async () => ({
        sources: [
          { url: "https://campaign.example/" },
          { url: "https://party.example/" },
        ],
      }),
      fetch: async (id, url) =>
        source(
          id,
          url,
          url.includes(".example")
            ? `${member.name} California Governor 2026. Paid for by ${member.name} for Governor. ${"We support schools and will expand public services with a budget proposal. ".repeat(6)}`
            : "Official institutional responsibilities and powers. No candidate website or statement listed.",
        ),
    },
  );
  assert.equal(result.classification, "evidence_gap");
  assert.equal(
    result.evidence.some(
      (item) =>
        item.origin === "reporting" ||
        item.role === "candidate_statement" ||
        item.role === "candidate_record",
    ),
    false,
  );
});
test("image source archives preserve actual bytes without fabricating quote text", async () => {
  const raw = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2]);
  const result = await fetchBoundedCaliforniaSource(
    "map",
    "https://example.com/map.png",
    "Official map",
    "image",
    { request() {}, bytes() {} },
    undefined,
    {
      addresses: async () => [{ address: "93.184.216.34", family: 4 }],
      transport: async () => new Response(raw),
    },
  );
  assert.equal(result.text, "");
  assert.equal(
    result.contentHash,
    createHash("sha256").update("").digest("hex"),
  );
  assert.equal(result.byteHash, createHash("sha256").update(raw).digest("hex"));
  assert.equal(result.binaryBase64, raw.toString("base64"));
});

test("local campaign discovery without an official provenance chain stays an evidence gap", async () => {
  const { snapshot, race } = await fixture();
  const member = race.members[0]!;
  race.officeFamily = "local";
  race.kind = "election";
  race.office = "San José Unified SD";
  const roster = source(
    "local-roster",
    "https://county.example.gov/roster",
    `${member.name} San José Unified SD 2026`,
  );
  snapshot.additionalSources = [roster];
  member.sourceProof = {
    url: roster.url,
    contentHash: roster.contentHash,
    excerpt: member.name,
    locator: "Official roster member",
  };
  const result = await collectCaliforniaEvidence(
    { snapshot, race, member },
    {
      now: () => now,
      sharedSources: new Map(),
      budget: { request() {}, bytes() {} },
      search: async () => ({
        sources: [{ url: "https://local-campaign.example/" }],
      }),
      fetch: async (id, url) =>
        source(
          id,
          url,
          url.includes("local-campaign")
            ? `${member.name} California 2026 San José Unified SD. ${"I will support schools and expand programs. ".repeat(10)}`
            : url.includes("DBASBulletins")
              ? "The governing board of each district conducts budget and LCAP hearings before final adoption."
              : "Official source with no candidate website listed.",
        ),
    },
  );
  assert.equal(result.classification, "evidence_gap");
  assert.equal(
    result.evidence.some(
      (item) =>
        item.role === "candidate_record" || item.role === "candidate_statement",
    ),
    false,
  );
});
test("official campaign link remains candidate attributed after a verified public redirect", async () => {
  const { snapshot, race } = await fixture();
  const member = race.members[0]!;
  const result = await collectCaliforniaEvidence(
    { snapshot, race, member },
    {
      now: () => now,
      sharedSources: new Map(),
      budget: { request() {}, bytes() {} },
      search: async () => ({ sources: [] }),
      fetch: async (id, url) =>
        url.includes("contact-list")
          ? source(
              id,
              url,
              `${member.name}\nWEBSITE: https://campaign-old.example\n${race.members[1]!.name}`,
            )
          : url === "https://campaign-old.example"
            ? source(
                id,
                "https://campaign-current.example/",
                `${member.name} ${"I will support schools and expand public services through a budget proposal. ".repeat(8)}`,
              )
            : source(id, url, "Official office responsibilities and powers."),
    },
  );
  const evidence = result.evidence.find(
    (item) => item.role === "candidate_statement",
  );
  assert.ok(evidence);
  assert.equal(evidence.origin, "candidate");
  assert.ok(
    result.sourceLinks?.some(
      (link) =>
        link.relation === "official_contact" &&
        link.url === "https://campaign-current.example/",
    ),
  );
});

test("text sources preserve UTF8 while the exact SOS feed retains Windows1252 decoding", async () => {
  const controls = (bytes: Uint8Array) => ({
    addresses: async () => [{ address: "93.184.216.34", family: 4 }],
    transport: async () => new Response(bytes),
  });
  const utf8 = "San José’s governing board adopts policies and budgets.";
  const normal = await fetchBoundedCaliforniaSource(
    "utf8",
    "https://district.example.gov/authority",
    "District",
    "text",
    { request() {}, bytes() {} },
    undefined,
    controls(Buffer.from(utf8)),
  );
  assert.equal(normal.text, utf8);
  const cp = Buffer.concat([
    Buffer.from("Candidate San Jos"),
    Buffer.from([0xe9]),
    Buffer.from(" official California roster archive"),
  ]);
  const sos = await fetchBoundedCaliforniaSource(
    "sos",
    "https://media.sos.ca.gov/media/C26GG.txt",
    "SOS",
    "text",
    { request() {}, bytes() {} },
    undefined,
    controls(cp),
  );
  assert.equal(
    sos.text,
    "Candidate San José official California roster archive",
  );
});

test("previous dossier finance renewal preserves archive IDs and semantic digest", async () => {
  const { snapshot } = await fixture();
  const race = snapshot.races.find((race) =>
    race.members.some((member) => member.name === "Mike McGuire"),
  )!;
  const member = race.members.find((member) => member.name === "Mike McGuire")!;
  let fetchedAt = now;
  const fetcher = async (id: string, url: string) => {
    const text = url.includes("candidates/search/")
      ? JSON.stringify({
          results: [
            {
              candidate_id: "H6CA01269",
              name: "MCGUIRE, MIKE",
              office: "H",
              state: "CA",
              district: "01",
              cycles: [2026],
              election_years: [2026],
            },
          ],
          pagination: { count: 1, pages: 1, page: 1 },
        })
      : url.includes("www.fec.gov")
        ? "MCGUIRE, MIKE Candidate for House California - 1 ID: H6CA01269 Data is included from these committees: TEST COMMITTEE (C00503185) Total raised Coverage dates: 01/01/2025 to 06/30/2026 Total receipts $100.00 Total individual contributions $70.00 Party committee contributions $5.00 Other committee contributions $5.00 Candidate contributions $5.00 Transfers from other authorized committees $5.00 Loans made by candidate $5.00 Other loans $1.00 Offsets to operating expenditures $1.00 Other receipts $3.00 Newly filed summary data may not appear for up to 48 hours. Total contribution refunds $2.00"
        : "Official office responsibilities and powers. No candidate statement or website listed.";
    return {
      ...source(id, url, text),
      format: url.includes("candidates/search/")
        ? ("json" as const)
        : ("html" as const),
      fetchedAt,
    };
  };
  const deps = () => ({
    fetch: fetcher,
    now: () => fetchedAt,
    sharedSources: new Map<string, Promise<ResearchSource>>(),
    budget: { request() {}, bytes() {} },
    search: async () => ({ sources: [] }),
  });
  const first = await collectCaliforniaEvidence(
    { snapshot, race, member },
    deps(),
  );
  assert.ok(first.finance);
  fetchedAt = "2026-10-30T13:00:00.000Z";
  const second = await collectCaliforniaEvidence(
    { snapshot, race, member, previousDossier: first },
    deps(),
  );
  assert.equal(second.dossierDigest, first.dossierDigest);
  assert.equal(second.sourceSetDigest, first.sourceSetDigest);
  assert.deepEqual(
    second.sources.map((source) => source.id).sort(),
    first.sources.map((source) => source.id).sort(),
  );
});
