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
  assert.equal(evidence.attribution?.status, "official_candidate_statement");
  assert.equal(evidence.attribution!.context.excerpt, evidence.excerpt);
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
  const text = `${member.name} is endorsed by ${endorser.name}. ${"I will protect public services and support public schools through published budget proposals. ".repeat(5)}\nLinked source navigation (discovery only):\nDonate => https://example.com/donate\nCampaign publisher disclosure (identity only):\nPaid for by ${member.name} for Governor.`;
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
  const entry = result.evidence.find((e) => e.role === "campaign_material");
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
            ? `${member.name}\nLinked source navigation (discovery only):\nIssues => https://www.example.com/issues\nDonate => https://www.example.com/donate\nCampaign publisher disclosure (identity only):\nPaid for by ${member.name} for Governor.`
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
      entry.role === "campaign_material" &&
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
    "Steve Hilton Jr.",
    "Steve Hilton, Jr.",
    "Steve Hilton II",
    "Steve Hilton III",
    "Steve Hilton Sr.",
    "Steve Hilton Junior",
    "Steve Hilton Senior",
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
        item.role === "campaign_material" ||
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
        item.role === "candidate_record" || item.role === "campaign_material",
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
                `${member.name} ${"I will support schools and expand public services through a budget proposal. ".repeat(8)}\nLinked source navigation (discovery only):\n\nCampaign publisher disclosure (identity only):\nPaid for by ${member.name} for Governor.`,
              )
            : source(id, url, "Official office responsibilities and powers."),
    },
  );
  const evidence = result.evidence.find(
    (item) => item.role === "campaign_material",
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

async function localCampaignFixture() {
  const { snapshot } = await fixture();
  const qualified = await readFile(
    new URL("./fixtures/scc-qualified-2026.txt", import.meta.url),
    "utf8",
  );
  const historical = {
    ...source(
      "historical-qualified",
      "https://files.santaclaracounty.gov/exjcpb1296/2026-09/qualified-list-of-local-candidates-9-28-26.pdf",
      qualified,
    ),
    format: "pdf" as const,
    fetchedAt: "2026-10-20T00:00:00.000Z",
  };
  const contestId = "ca-scc-clarity:2026-11-03:127570:32";
  const candidateId = contestId + ":choice:56";
  const jurisdiction = "ocd-division/country:us/state:ca/place:san_jose";
  const roster = source(
    "current-clarity",
    "https://results.enr.clarityelections.com/CA/Santa_Clara/127570/382435/json/en/summary.json",
    "Current authoritative roster: Anne J. Kepner, West Valley-Mission CCD, 2026-11-03.",
  );
  const member = {
    candidateId,
    sourceCandidateId: "56",
    identity: {
      candidateId,
      contestId,
      jurisdiction,
      electionDate: "2026-11-03",
    },
    name: "Anne J. Kepner",
    party: null,
    partyCode: "",
    ballotStatus: "on_ballot" as const,
    sourceProof: {
      url: roster.url,
      contentHash: roster.contentHash,
      excerpt: "Anne J. Kepner",
      locator: "Current Clarity choice56",
    },
  };
  const race = {
    raceKey: "local-wvm-3253",
    contestId,
    jurisdiction,
    jurisdictionLabel: "San José",
    electionDate: "2026-11-03",
    sourceContestId: "3253",
    officeFamily: "local" as const,
    office: "West Valley-Mission CCD",
    district: null,
    kind: "election" as const,
    rosterDigest: "a".repeat(64),
    members: [member],
  };
  snapshot.races = [race];
  snapshot.additionalSources = [roster];
  snapshot.historicalSources = [historical];
  snapshot.localPrimary = {
    kind: "scc_clarity",
    definitionURL: roster.url,
    settingsURL:
      "https://results.enr.clarityelections.com/CA/Santa_Clara/127570/382435/json/en/electionsettings.json",
    currentVersionURL:
      "https://results.enr.clarityelections.com/CA/Santa_Clara/127570/current_ver.txt",
    identityCrosswalk: {
      schemaVersion: 1,
      electionDate: "2026-11-03",
      definitionHash: roster.contentHash,
      members: [
        {
          sourceContestId: "3253",
          sourceOrdinal: "1",
          clarityContestKey: "32",
          clarityChoiceIndex: 0,
          name: member.name,
          status: "on_ballot",
        },
      ],
      review: {
        actorId: "fixture-reviewed",
        reviewedAt: now,
        digest: "a".repeat(64),
      },
    },
  };
  snapshot.localCrosswalk = {
    schemaVersion: 1,
    electionDate: "2026-11-03",
    rosterSourceHash: historical.contentHash,
    method: "Fixture reviewed source binding.",
    entries: [
      {
        sourceContestId: "3253",
        status: "include",
        reason: "Fixture verified territory",
        proofs: [],
      },
    ],
    review: {
      actorId: "fixture-reviewed",
      reviewedAt: now,
      digest: "a".repeat(64),
    },
  };
  const urls: string[] = [];
  let redirect = false,
    institutional = false;
  const deps = {
    now: () => now,
    sharedSources: new Map<string, Promise<ResearchSource>>(),
    budget: { request() {}, bytes() {} },
    search: async () => ({ sources: [] }),
    fetch: async (
      id: string,
      url: string,
      publisher: string,
      format: ResearchSource["format"],
    ) => {
      urls.push(url);
      if (url.includes("annekepner.org"))
        return fetchBoundedCaliforniaSource(
          id,
          url,
          publisher,
          format,
          { request() {}, bytes() {} },
          undefined,
          {
            addresses: async () => [{ address: "93.184.216.34", family: 4 }],
            transport: async (current) => {
              if (redirect && !current.endsWith("/current"))
                return new Response(null, {
                  status: 302,
                  headers: { location: "/current" },
                });
              return new Response(
                `<html><body>Anne J. Kepner ${institutional ? "serves on a board. Institutional board members and administrative policies are listed here. The board will vote on the annual fundraising campaign; donate to the student foundation. Principal Garcia: My vision is to improve reading, and I will support every student. ".repeat(8) : "for Trustee. I will support affordable college access and expand student programs through a transparent budget proposal. ".repeat(8)}</body>${institutional ? "" : "<footer>Paid for by Anne J. Kepner for Trustee.</footer>"}</html>`,
              );
            },
          },
        ).then((archive) => ({ ...archive, fetchedAt: now }));
      return source(
        id,
        url,
        url.includes("legislative-and-policy")
          ? "This standing committee reviews policy and recommends proposals to the Board."
          : "The Board may adopt such policies as law permits and delegates administration to the Chancellor.",
      );
    },
  };
  return {
    snapshot,
    race,
    member,
    historical,
    deps,
    urls,
    setRedirect() {
      redirect = true;
    },
    setInstitutional() {
      institutional = true;
    },
  };
}
test("local official Website proof accepts a fresh Anne Kepner campaign without renewing the historical PDF", async () => {
  const f = await localCampaignFixture();
  const dossier = await collectCaliforniaEvidence(f, f.deps);
  assert.equal(dossier.classification, "supported");
  assert.equal(
    dossier.campaignContactProof?.identity.candidateId,
    f.member.candidateId,
  );
  assert.equal(
    dossier.campaignContactProof?.officialSource.fetchedAt,
    "2026-10-20T00:00:00.000Z",
  );
  assert.ok(
    dossier.evidence.some(
      (e) => e.origin === "candidate" && e.role === "campaign_material",
    ),
  );
  assert.equal(
    dossier.sources.some((s) => s.url === f.historical.url),
    false,
  );
  assert.equal(
    f.urls.some((url) => url.includes("contact-list.pdf")),
    false,
  );
});
test("local historical Website proof records only observed public redirects", async () => {
  const f = await localCampaignFixture();
  f.setRedirect();
  const dossier = await collectCaliforniaEvidence(f, f.deps);
  assert.equal(dossier.classification, "supported");
  assert.deepEqual(dossier.campaignContactProof?.retrievalUrls, [
    "https://annekepner.org/",
    "https://annekepner.org/current",
  ]);
});
test("filed institutional website is an identity lead, not candidate authorship", async () => {
  const f = await localCampaignFixture();
  f.setInstitutional();
  const dossier = await collectCaliforniaEvidence(f, f.deps);
  assert.equal(dossier.classification, "evidence_gap");
  assert.equal(dossier.campaignContactProof, undefined);
});
for (const invalid of [
  "wrong-row",
  "wrong-hash",
  "unsafe-url",
  "absent-website",
] as const)
  test(`local ${invalid} filing cannot qualify a campaign source`, async () => {
    const f = await localCampaignFixture();
    if (invalid === "wrong-row") f.member.sourceCandidateId = "57";
    else if (invalid === "wrong-hash")
      f.historical.contentHash = "b".repeat(64);
    else {
      const start = f.historical.text.indexOf("Anne J. Kepner");
      const at = f.historical.text.indexOf("Website:annekepner.org", start);
      f.historical.text =
        f.historical.text.slice(0, at) +
        (invalid === "unsafe-url"
          ? "Website:http://127.0.0.1:10531"
          : "Website:") +
        f.historical.text.slice(at + "Website:annekepner.org".length);
      f.historical.contentHash = createHash("sha256")
        .update(f.historical.text)
        .digest("hex");
      f.snapshot.localCrosswalk!.rosterSourceHash = f.historical.contentHash;
    }
    const dossier = await collectCaliforniaEvidence(f, f.deps);
    assert.equal(dossier.classification, "evidence_gap");
    assert.equal(dossier.campaignContactProof, undefined);
    assert.equal(
      f.urls.some(
        (url) => url.includes("annekepner.org") || url.includes("127.0.0.1"),
      ),
      false,
    );
  });

test("unchanged local campaign redirect proof renews from the actual fresh filed-URL chain", async () => {
  const f = await localCampaignFixture();
  f.setRedirect();
  const first = await collectCaliforniaEvidence(f, f.deps);
  f.deps.sharedSources.clear();
  const second = await collectCaliforniaEvidence(
    { ...f, previousDossier: first },
    f.deps,
  );
  assert.equal(second.dossierDigest, first.dossierDigest);
  assert.deepEqual(
    second.campaignContactProof?.retrievalUrls,
    first.campaignContactProof?.retrievalUrls,
  );
});
test("unavailable filed campaign page remains a retrieval gap without a fabricated proof", async () => {
  const f = await localCampaignFixture();
  const fetch = f.deps.fetch;
  f.deps.fetch = async (id, url, publisher, format) => {
    if (url.includes("annekepner.org"))
      throw Error("Source request failed (404)");
    return fetch(id, url, publisher, format);
  };
  const dossier = await collectCaliforniaEvidence(f, f.deps);
  assert.equal(dossier.classification, "evidence_gap");
  assert.equal(dossier.campaignContactProof, undefined);
  assert.ok(dossier.gaps.some((gap) => gap.code === "source_unavailable"));
});

test("a filed URL and quoted campaign slogan do not establish institutional publisher ownership", async () => {
  const f = await localCampaignFixture();
  const original = f.deps.fetch;
  f.deps.fetch = async (id, url, publisher, format) => {
    if (!url.includes("annekepner.org"))
      return original(id, url, publisher, format);
    return {
      ...source(
        id,
        "https://institution.example/board",
        "Anne J. Kepner serves on our board. Election news: Elect Anne J. Kepner for Trustee. Principal Garcia says: I will expand our student foundation and support every school. ".repeat(
          8,
        ),
      ),
      retrievalUrls: [url, "https://institution.example/board"],
    };
  };
  const dossier = await collectCaliforniaEvidence(f, f.deps);
  assert.equal(dossier.campaignContactProof, undefined);
  assert.equal(
    dossier.evidence.some((entry) => entry.role === "campaign_material"),
    false,
  );
  assert.notEqual(dossier.classification, "supported");
});

test("same-origin campaign children do not inherit the candidate as every passage speaker", async () => {
  const f = await localCampaignFixture();
  const original = f.deps.fetch;
  f.deps.fetch = async (id, url, publisher, format) => {
    if (!url.includes("annekepner.org"))
      return original(id, url, publisher, format);
    const body = url.endsWith("/issues-foundation")
      ? "Principal Garcia says: I will expand our student foundation and support every school. ".repeat(
          8,
        )
      : "Anne J. Kepner for Trustee. I will support college access. ".repeat(
          8,
        ) +
        "\nLinked source navigation (discovery only):\nIssues foundation => https://annekepner.org/issues-foundation\nCampaign publisher disclosure (identity only):\nPaid for by Anne J. Kepner for Trustee.";
    return { ...source(id, url, body), retrievalUrls: [url] };
  };
  const dossier = await collectCaliforniaEvidence(f, f.deps);
  assert.ok(dossier.campaignContactProof);
  assert.ok(
    dossier.evidence.some((entry) => entry.role === "campaign_material"),
  );
  assert.equal(
    dossier.evidence.some(
      (entry) =>
        entry.role === "campaign_material" &&
        entry.excerpt.includes("Principal Garcia") &&
        entry.attribution?.status === "unresolved",
    ),
    true,
  );
});

test("only unquoted legal publisher disclosures qualify filed destinations", async () => {
  for (const [disclosure, accepted] of [
    ["<footer>Paid for by Anne J. Kepner for Trustee.</footer>", true],
    [
      '<div class="legal-disclaimer">Authorized and paid for by Anne J. Kepner for Trustee.</div>',
      true,
    ],
    ["<footer><q>Paid for by Anne J. Kepner for Trustee.</q></footer>", false],
    [
      "<footer><blockquote>Paid for by Anne J. Kepner for Trustee.</blockquote></footer>",
      false,
    ],
    [
      "<footer>News reports say “Paid for by Anne J. Kepner for Trustee.”</footer>",
      false,
    ],
    [
      "<footer>News reports say 'Paid for by Anne J. Kepner for Trustee.'</footer>",
      false,
    ],
    [
      "<footer>Paid for by Anne J. Kepner for Trustee. Independent expenditure, not authorized by the candidate.</footer>",
      false,
    ],
    ["<footer>Paid for by Anne J. Kepner Jr. for Trustee.</footer>", false],
    ["<article>Paid for by Anne J. Kepner for Trustee.</article>", false],
  ] as const) {
    const f = await localCampaignFixture();
    const original = f.deps.fetch;
    f.deps.fetch = async (id, url, publisher, format) => {
      if (!url.includes("annekepner.org"))
        return original(id, url, publisher, format);
      return fetchBoundedCaliforniaSource(
        id,
        url,
        publisher,
        format,
        { request() {}, bytes() {} },
        undefined,
        {
          addresses: async () => [{ address: "93.184.216.34", family: 4 }],
          transport: async () =>
            new Response(
              `<html><body><main>Anne J. Kepner for Trustee. ${"I will support affordable college access through a public budget proposal. ".repeat(8)}</main>${disclosure}</body></html>`,
            ),
        },
      ).then((archive) => ({ ...archive, fetchedAt: now }));
    };
    const dossier = await collectCaliforniaEvidence(f, f.deps);
    assert.equal(!!dossier.campaignContactProof, accepted, disclosure);
    assert.equal(
      dossier.evidence.some((entry) => entry.role === "campaign_material"),
      accepted,
      disclosure,
    );
    if (accepted) {
      const destination = dossier.sources.find((entry) =>
        entry.url.includes("annekepner.org"),
      )!;
      assert.ok(
        destination.text.includes(
          "Campaign publisher disclosure (identity only):",
        ),
      );
      assert.equal(
        destination.text
          .split("\nLinked source navigation (discovery only):\n")[0]!
          .includes("Paid for by"),
        false,
      );
      assert.equal(
        dossier.evidence.some((entry) => entry.excerpt.includes("Paid for by")),
        false,
      );
    }
  }
});

test("a campaign-owned page cannot assign an endorsement speaker's commitments to the candidate", async () => {
  for (const thirdParty of [
    "Principal Garcia says: I will expand the student foundation and support every school. ",
    "Principal Garcia says I will expand the student foundation and support every school. ",
    "Principal Garcia: I will expand the student foundation and support every school. ",
    "“I will expand the student foundation and support every school,” says Principal Garcia. ",
    "'I will expand our student foundation and support every school,' says Principal Garcia. ",
    "‘I will expand our student foundation and support every school,’ says Principal Garcia. ",
    "Our principal says: I will expand our student foundation and support every school. ",
    "our principal says I will expand our student foundation and support every school. ",
    "According to our principal, I will expand our student foundation and support every school. ",
    "the principal: I will expand our student foundation and support every school. ",
    "In the words of our principal, I will expand our student foundation and support every school. ",
  ]) {
    const f = await localCampaignFixture();
    const original = f.deps.fetch;
    f.deps.fetch = async (id, url, publisher, format) => {
      if (!url.includes("annekepner.org"))
        return original(id, url, publisher, format);
      const body = `Anne J. Kepner for Trustee. ${"I will support college access through a public budget proposal. ".repeat(5)}${thirdParty.repeat(5)}\nLinked source navigation (discovery only):\n\nCampaign publisher disclosure (identity only):\nPaid for by Anne J. Kepner for Trustee.`;
      return { ...source(id, url, body), retrievalUrls: [url] };
    };
    const dossier = await collectCaliforniaEvidence(f, f.deps);
    const statements = dossier.evidence.filter(
      (entry) => entry.role === "campaign_material",
    );
    assert.equal(statements.length, 1);
    assert.equal(statements[0]!.attribution?.status, "unresolved");
    assert.ok(
      statements[0]!.attribution!.context.excerpt.includes(thirdParty.trim()),
    );
    assert.equal(
      dossier.evidence.some((entry) => entry.role === "candidate_statement"),
      false,
    );
  }
});

test("the archived McGuire campaign excerpt alone does not prove its stripped publisher disclosure", async () => {
  const { snapshot } = await fixture();
  const race = snapshot.races.find((target) =>
    target.members.some((member) => member.name === "Mike McGuire"),
  )!;
  const member = race.members.find(
    (candidate) => candidate.name === "Mike McGuire",
  )!;
  const dossier = await collectCaliforniaEvidence(
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
            ? `${member.name}\nWEBSITE: https://www.votemikemcguire.com/\n${race.members.find((other) => other.name !== member.name)!.name}`
            : url.includes("votemikemcguire")
              ? "When Northern California needs results, Mike McGuire delivers.No one fights harder for rural Californians and our communities than Senator Mike McGuire. He’s one of California’s few rural Democratic leaders at the state level—the first to rise up to serve as Leader of the Senate in over a century."
              : "Official office authority and constitutional responsibilities.",
        ),
    },
  );
  assert.equal(
    dossier.evidence.some((entry) => entry.role === "campaign_material"),
    false,
  );
});

test("campaign material preserves full context beside a different speaker", async () => {
  const f = await localCampaignFixture();
  const original = f.deps.fetch;
  const ownPassage =
    "Anne J. Kepner for Trustee. " +
    "I will support college access through a public budget proposal. ".repeat(
      5,
    );
  const otherPassage =
    "Our principal says: I will expand our student foundation and support every school. ".repeat(
      5,
    );
  f.deps.fetch = async (id, url, publisher, format) => {
    if (!url.includes("annekepner.org"))
      return original(id, url, publisher, format);
    return fetchBoundedCaliforniaSource(
      id,
      url,
      publisher,
      format,
      { request() {}, bytes() {} },
      undefined,
      {
        addresses: async () => [{ address: "93.184.216.34", family: 4 }],
        transport: async () =>
          new Response(
            `<html><body><main><p>${ownPassage}</p><p>${otherPassage}</p><blockquote><p>'I will expand our student foundation,' says Principal Garcia.</p></blockquote></main><footer>Paid for by Anne J. Kepner for Trustee.</footer></body></html>`,
          ),
      },
    ).then((archive) => ({ ...archive, fetchedAt: now }));
  };
  const dossier = await collectCaliforniaEvidence(f, f.deps);
  const statements = dossier.evidence.filter(
    (entry) => entry.role === "campaign_material",
  );
  assert.equal(statements.length, 1);
  assert.equal(statements[0]!.attribution?.status, "unresolved");
  assert.ok(
    statements[0]!.attribution!.context.excerpt.includes(ownPassage.trim()),
  );
  assert.ok(
    statements[0]!.attribution!.context.excerpt.includes(otherPassage.trim()),
  );
  const archived = dossier.sources.find(
    (entry) => entry.id === statements[0]!.sourceId,
  )!;
  assert.ok(archived.text.includes(ownPassage.trim()));
  assert.equal(
    statements[0]!.attribution!.context.excerpt,
    archived.text.split("\nLinked source navigation (discovery only):\n")[0],
  );
  assert.equal(
    archived.text
      .split("\nLinked source navigation (discovery only):\n")[0]!
      .includes("Campaign passage blocks"),
    false,
  );
});

test("campaign material retains a different speaker's sibling heading in exact unresolved context", async () => {
  const f = await localCampaignFixture();
  const original = f.deps.fetch;
  const speech =
    "I will expand our student foundation and support every school. ".repeat(4);
  f.deps.fetch = async (id, url, publisher, format) => {
    if (!url.includes("annekepner.org"))
      return original(id, url, publisher, format);
    return fetchBoundedCaliforniaSource(
      id,
      url,
      publisher,
      format,
      { request() {}, bytes() {} },
      undefined,
      {
        addresses: async () => [{ address: "93.184.216.34", family: 4 }],
        transport: async () =>
          new Response(
            `<html><body><main><h1>Anne J. Kepner for Trustee</h1><section><h2>Statement by Principal Garcia</h2><p>${speech}</p></section></main><footer>Paid for by Anne J. Kepner for Trustee.</footer></body></html>`,
          ),
      },
    ).then((archive) => ({ ...archive, fetchedAt: now }));
  };
  const dossier = await collectCaliforniaEvidence(f, f.deps);
  const material = dossier.evidence.find(
    (entry) => entry.role === "campaign_material",
  )!;
  assert.ok(material);
  assert.equal(material.origin, "candidate");
  assert.equal(material.attribution?.status, "unresolved");
  assert.ok(
    material.attribution!.context.excerpt.includes(
      "Statement by Principal Garcia",
    ),
  );
  assert.ok(material.attribution!.context.excerpt.includes(speech.trim()));
  const archive = dossier.sources.find(
    (entry) => entry.id === material.sourceId,
  )!;
  assert.equal(
    material.attribution!.context.excerpt,
    archive.text.split("\nLinked source navigation (discovery only):\n")[0],
  );
  assert.ok(material.attribution!.context.excerpt.includes(material.excerpt));
  assert.equal(
    dossier.evidence.some((entry) => entry.role === "candidate_statement"),
    false,
  );
});

test("campaign context over the complete-page bound is a gap instead of a clipped speaker attribution", async () => {
  const f = await localCampaignFixture();
  const original = f.deps.fetch;
  f.deps.fetch = async (id, url, publisher, format) => {
    if (!url.includes("annekepner.org"))
      return original(id, url, publisher, format);
    return {
      ...source(
        id,
        url,
        "Anne J. Kepner for Trustee. " +
          "I will support affordable college access. ".repeat(320) +
          "Statement by Principal Garcia.\nLinked source navigation (discovery only):\n\nCampaign publisher disclosure (identity only):\nPaid for by Anne J. Kepner for Trustee.",
      ),
      retrievalUrls: [url],
    };
  };
  const dossier = await collectCaliforniaEvidence(f, f.deps);
  assert.equal(
    dossier.evidence.some(
      (entry) =>
        entry.role === "campaign_material" ||
        entry.role === "candidate_statement",
    ),
    false,
  );
  assert.ok(
    dossier.gaps.some((gap) => gap.message.includes("bounded context limit")),
  );
  assert.equal(dossier.classification, "evidence_gap");
});
