import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";

import type { ResearchSource } from "@acme/validators";

import { publicSourceAddresses } from "../research/pages.js";
import { buildCaliforniaDossier } from "./california-dossier.js";
import {
  CaliforniaBudgetReached,
  CaliforniaCitedSourceFailure,
  californiaLocalAuthority,
  collectCaliforniaEvidence,
  fetchBoundedCaliforniaSource,
  qualifiedCandidatePage,
} from "./california-evidence.js";
import { decodeCaliforniaRoster } from "./california-roster.js";
import {
  CaliforniaSourceHttpError,
  isCaliforniaSourceUnavailable,
} from "./california-source-availability.js";

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
  assert.equal(fetched, 2);
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
  const selectedRow =
    "H6CA01269|MCGUIRE, MIKE|DEM|2026|CA|H|01|C|C|C00503185|||||";
  let masterText = `${selectedRow}\n`;
  const fetcher = async (id: string, url: string) => {
    const text = url.endsWith("cn26.zip")
      ? masterText
      : url.includes("/reports/house-senate/")
        ? JSON.stringify({
            results: [
              {
                committee_id: "C00503185",
                cycle: 2026,
                file_number: 1234567,
                most_recent_file_number: 1234567,
                most_recent: true,
                is_amended: false,
                report_form: "Form 3",
                coverage_start_date: "2026-04-01",
                coverage_end_date: "2026-06-30",
              },
            ],
            pagination: { count: 1, pages: 1, page: 1, is_count_exact: true },
          })
        : url.endsWith("1234567.fec")
          ? "HDR\u001cFEC\u001c8.5\n" +
            [
              "F3N",
              "C00503185",
              "TEST COMMITTEE",
              ...Array.from({ length: 12 }, () => ""),
              "20260401",
              "20260630",
            ].join("\u001c")
          : url.includes("/schedule_e/by_candidate/")
            ? JSON.stringify({
                results: [],
                pagination: {
                  count: 0,
                  pages: 0,
                  page: 1,
                  is_count_exact: true,
                },
              })
            : url.includes("www.fec.gov")
              ? "MCGUIRE, MIKE Candidate for House California - 1 ID: H6CA01269 Financial summary Election 2026 Data is included from these committees: TEST COMMITTEE (C00503185) Total raised Coverage dates: 01/01/2025 to 06/30/2026 Total receipts $100.00 Total individual contributions $70.00 Party committee contributions $5.00 Other committee contributions $5.00 Candidate contributions $5.00 Transfers from other authorized committees $5.00 Loans made by candidate $5.00 Other loans $1.00 Offsets to operating expenditures $1.00 Other receipts $3.00 Newly filed summary data may not appear for up to 48 hours. Total contribution refunds $2.00"
              : "Official office responsibilities and powers. No candidate statement or website listed.";
    return {
      ...source(id, url, text),
      format: url.includes("api.open.fec.gov")
        ? ("json" as const)
        : url.endsWith(".fec") || url.endsWith(".zip")
          ? ("text" as const)
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
  masterText += "H6CA99999|OTHER, PERSON|REP|2026|CA|H|02|C|C|C00999999|||||\n";
  const renewed = await collectCaliforniaEvidence(
    { snapshot, race, member, previousDossier: first },
    deps(),
  );
  const master = renewed.sources.find((entry) =>
    entry.url.endsWith("cn26.zip"),
  )!;
  assert.equal(master.text, masterText);
  assert.equal(
    master.contentHash,
    createHash("sha256").update(masterText).digest("hex"),
  );
  assert.notEqual(master.contentHash, first.financeIdentityProof!.sourceHash);
  assert.equal(renewed.financeIdentityProof?.sourceHash, master.contentHash);
  for (const [column, value] of [
    [0, "H6CA01999"],
    [1, "MCGUIRE, OTHER"],
    [2, "REP"],
    [3, "2024"],
    [4, "NV"],
    [5, "S"],
    [6, "02"],
    [7, "I"],
    [8, "N"],
    [9, "C00999999"],
  ] as const) {
    const fields = selectedRow.split("|");
    fields[column] = value;
    masterText = `${fields.join("|")}\n`;
    await assert.rejects(
      collectCaliforniaEvidence(
        { snapshot, race, member, previousDossier: first },
        deps(),
      ),
      CaliforniaCitedSourceFailure,
    );
  }
  for (const changed of [
    "",
    `${selectedRow}\n${selectedRow}\n`,
    `${selectedRow}\n${selectedRow.replace("H6CA01269", "H6CA01999")}\n`,
  ]) {
    masterText = changed;
    await assert.rejects(
      collectCaliforniaEvidence(
        { snapshot, race, member, previousDossier: first },
        deps(),
      ),
      CaliforniaCitedSourceFailure,
    );
  }
  masterText = `${selectedRow}\nH6CA99999|OTHER, PERSON|REP|2026|CA|H|02|C|C|C00999999|||||\n`;
  const identityEvidence = first.evidence.find(
    (entry) => entry.sourceId === first.financeIdentityProof!.sourceId,
  )!;
  for (const previousDossier of [
    {
      ...first,
      evidence: first.evidence.map((entry) =>
        entry === identityEvidence
          ? { ...entry, role: "candidate_record" as const }
          : entry,
      ),
    },
    {
      ...first,
      evidence: first.evidence.map((entry) =>
        entry === identityEvidence
          ? { ...entry, excerpt: "Changed cited passage" }
          : entry,
      ),
    },
    {
      ...first,
      gaps: [
        ...first.gaps,
        {
          dimension: "record" as const,
          code: "not_found_in_checked_sources" as const,
          message: "Missing record",
          checkedSourceIds: [identityEvidence.sourceId],
          required: false,
        },
      ],
    },
    {
      ...first,
      financeIdentityProof: {
        ...first.financeIdentityProof!,
        sourceHash: "0".repeat(64),
      },
    },
    {
      ...first,
      sourceLinks: [
        {
          fromSourceId: identityEvidence.sourceId,
          toSourceId: "official-roster",
          url: snapshot.source.url,
          anchorText: "Official roster",
          relation: "official_contact" as const,
        },
      ],
    },
  ]) {
    await assert.rejects(
      collectCaliforniaEvidence(
        { snapshot, race, member, previousDossier },
        deps(),
      ),
      CaliforniaCitedSourceFailure,
    );
  }
});

for (const failure of [
  503,
  429,
  "timeout",
  404,
  410,
  "malformed",
  "changed",
] as const) {
  test(`previous cited source refresh preserves availability semantics for ${failure}`, async () => {
    const { snapshot, race } = await fixture();
    const member = race.members[0]!;
    const deps = {
      now: () => now,
      sharedSources: new Map<string, Promise<ResearchSource>>(),
      budget: { request() {}, bytes() {} },
      search: async () => ({ sources: [] }),
      fetch: async (id: string, url: string) =>
        source(id, url, "Official office description."),
    };
    const initial = await collectCaliforniaEvidence(
      { snapshot, race, member },
      deps,
    );
    const cited = source(
      "candidate-record",
      "https://fixture.example.gov/record",
      `${member.name} served on an oversight board.`,
    );
    const previousDossier = buildCaliforniaDossier({
      ...initial,
      sources: [...initial.sources, cited],
      evidence: [
        ...initial.evidence,
        {
          id: "candidate-record",
          sourceId: cited.id,
          excerpt: cited.text,
          locator: "Official record",
          origin: "primary_record",
          role: "candidate_record",
          identityQualification: "exact_election_office",
        },
      ],
    });
    const fetch = deps.fetch;
    deps.sharedSources.clear();
    deps.fetch = async (id, url) => {
      if (url !== cited.url) return fetch(id, url);
      if (typeof failure === "number")
        throw new CaliforniaSourceHttpError(failure);
      if (failure === "timeout")
        throw Object.assign(new Error("acquisition timeout"), {
          code: "ETIMEDOUT",
        });
      if (failure === "malformed")
        throw new Error("Malformed authoritative document");
      return source(id, url, "Changed authoritative document");
    };
    await assert.rejects(
      collectCaliforniaEvidence(
        { snapshot, race, member, previousDossier },
        deps,
      ),
      (error) => {
        const transient =
          failure === 503 || failure === 429 || failure === "timeout";
        assert.equal(isCaliforniaSourceUnavailable(error), transient);
        assert.equal(error instanceof CaliforniaCitedSourceFailure, !transient);
        return true;
      },
    );
  });
}

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
      "<footer>If you've saved your payment information, you can donate. Paid for by Anne J. Kepner for Trustee.</footer>",
      true,
    ],
    [
      "<footer>If you’ve saved your payment information, you can donate. Paid for by Anne J. Kepner for Trustee.</footer>",
      true,
    ],
    [
      "<footer>The candidate's campaign. Paid for by Anne J. Kepner for Trustee.</footer>",
      true,
    ],
    ["<footer>‘Paid for by Anne J. Kepner for Trustee.’</footer>", false],
    [
      "<footer><div>According to the campaign, Paid for by Anne J. Kepner for Trustee.</div></footer>",
      false,
    ],
    ["<footer>Paid for by Some Other Person for Trustee.</footer>", false],
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

test("Lieutenant Governor authority selects actual archived constitutional powers instead of the incumbent biography", async () => {
  const powers: ResearchSource = {
    id: "lt-governor-powers",
    url: "https://ltg.ca.gov/about-the-office-of-lt-governor/",
    publisher: "Office of the California Lieutenant Governor",
    format: "html",
    text: "About the Office of Lt. Governor Under California’s Constitution, the Lieutenant Governor serves as Acting Governor whenever the Governor is absent from the state and automatically becomes Governor if a vacancy occurs in the Office of Governor. The Lieutenant Governor is also President of the Senate and votes in case of a tie. The Lieutenant Governor serves as a voting member of the Board of Regents of the University of California, the Board of Trustees of the California State University system, and the Board of Governors of the California Community Colleges system. The Lieutenant Governor also sits on the Calbright College Board of Trustees. The Lieutenant Governor also serves on and rotates with the State Controller as chair of the three-member State Lands Commission, which oversees the control and leasing of millions of acres of state-owned land, including offshore oil resources, as well as use and permitting for all navigable waterways in California. The Commission also manages state land-use planning, revenues, and related interstate issues. During alternate years, when the Lieutenant Governor serves as Chairperson of the State Lands Commission, she also serves as a California Ocean Protection Council member and a non-voting member of the California Coastal Commission. In addition, under state statutes, the Lieutenant Governor chairs the California Commission for Economic Development, which provides support and guidance to the Governor, Legislature, and private sector regarding the development of California’s economy. The Commission is comprised of appointees from the Legislature and the Governor, and currently, there is no quorum to meet.",
    contentHash:
      "72169db34d4623abe7e97812a4a236705ed80ec46befe0f9b5d72c2d2140aef0",
    fetchedAt: "2026-10-30T14:35:09.771Z",
  };
  const biography =
    "About Eleni Kounalakis Ambassador Eleni Kounalakis was sworn in as the 50th Lieutenant Governor of California by Governor Gavin Newsom on January 7th, 2019. She is the first woman elected Lt. Governor of California. A native Californian, she visited each of the state’s 58 counties during her historic campaign. In addition to her duties as Lt. Governor, Kounalakis is California’s Representative for International Affairs and Trade, appointed by Governor Gavin Newsom by executive order. From 2010 to 2013, Kounalakis served as President Obama’s Ambassador to the Republic of Hungary. Her highly acclaimed memoir, “Madam Ambassador, Three Years of Diplomacy, Dinner Parties and Democracy in Budapest” (The New Press, 2015), chronicles the onset of Hungary’s democratic backsliding. Governor Jerry Brown appointed Kounalakis to chair the California Advisory Council for International Trade and Investment in 2014. Kounalakis was a Virtual Fellow at the U.S. Department of State, Bureau of Intelligence and Research (INR) between 2014 and 2017, specializing in international trade and immigration. She is currently a director of the Association of American Ambassadors and a National Democratic Institute (NDI) “Ambassadors Circle” advisor. Prior to her public service, Kounalakis was president of one of California’s most respected housing development firms, AKT Development, where she worked for 18 years. She built master-planned communities and delivered quality housing to the Sacramento region’s working families – recognizing her as one of the capital region’s most prominent businesswomen. Passionate about early childhood development, Kounalakis served as a member of California’s First 5 Commission and the California Blue Ribbon Commission on Autism. Eleni Kounalakis graduated from Dartmouth College in 1989 and earned her Masters in Business Administration (MBA) from U.C. Berkeley’s Haas School of Business in 1992. She holds an Honorary Doctorate of Law from the American College of Greece and the University of Piraeus and is a member of the Council on Foreign Relations. She is married to Dr. Markos Kounalakis, and the couple has two sons, Neo and Eon.";
  assert.equal(
    powers.contentHash,
    createHash("sha256").update(powers.text).digest("hex"),
  );
  const { snapshot } = await fixture();
  const race = snapshot.races.find(
    (target) => target.office === "Lieutenant Governor",
  )!;
  const member = race.members[0]!;
  for (const useBiography of [false, true]) {
    const urls: string[] = [];
    const dossier = await collectCaliforniaEvidence(
      { snapshot, race, member },
      {
        now: () => now,
        sharedSources: new Map(),
        budget: { request() {}, bytes() {} },
        search: async () => ({ sources: [] }),
        fetch: async (id, url) => {
          urls.push(url);
          return url === powers.url
            ? useBiography
              ? source(id, url, biography)
              : powers
            : source(
                id,
                url,
                "Official contact source without a campaign website or candidate-specific statement.",
              );
        },
      },
    );
    assert.ok(urls.includes(powers.url));
    assert.equal(urls.includes("https://ltg.ca.gov/about/"), false);
    const evidence = dossier.evidence.find(
      (entry) => entry.role === "office_authority",
    );
    if (useBiography) {
      assert.equal(evidence, undefined);
      assert.ok(
        dossier.gaps.some(
          (gap) => gap.dimension === "mechanisms" && gap.required,
        ),
      );
    } else {
      assert.ok(evidence);
      assert.equal(evidence.sourceId, powers.id);
      assert.ok(powers.text.includes(evidence.excerpt));
      assert.ok(evidence.excerpt.includes("serves as Acting Governor"));
      assert.ok(
        evidence.excerpt.includes(
          "President of the Senate and votes in case of a tie",
        ),
      );
      assert.ok(
        evidence.excerpt.includes(
          "Board of Regents of the University of California",
        ),
      );
      assert.ok(evidence.excerpt.includes("State Lands Commission"));
      assert.equal(evidence.excerpt.includes("About Eleni Kounalakis"), false);
      const archived = dossier.sources.find(
        (entry) => entry.id === evidence.sourceId,
      )!;
      assert.equal(archived.contentHash, powers.contentHash);
      assert.equal(archived.fetchedAt, "2026-10-30T14:35:09.771Z");
    }
  }
});

test("Governor authority selects only the official role preface and never candidate statements or incumbent biography", async () => {
  const guide: ResearchSource = {
    id: "source-0adc75f3506cf755b1c17028",
    url: "https://voterguide.sos.ca.gov/candidates/governor-candidate-statements.htm",
    publisher: "voterguide.sos.ca.gov",
    format: "html",
    text: "Skip to Main Content Secretary of State Main Website Elections & Voter Information Feedback California General ElectionNovember 3, 2026 Official Voter Information Guide Home Propositions Candidates Justices Quick Reference Guide Voter Information Audio/PDF/Large Print Please Make a Selection Home Propositions Candidates Justices Quick Reference Guide Voter Information Audio/PDF/Large Print Home » Candidates Governor Candidate Statements As the state's chief executive officer, oversees most state departments and agencies, and appoints judges. Proposes new laws, approves or vetoes legislation, and submits the annual state budget to the Legislature. Mobilizes and directs state resources during emergencies. Xavier Becerra | DEMOCRATIC No candidate statement. Steve Hilton | REPUBLICAN No candidate statement. Back to the Top The views and opinions expressed by the candidates are their own and do not represent the views and opinions of the Secretary of State's office. The order of the statements was determined by randomized drawing. Statements on this page were supplied by the candidates and have not been checked for accuracy by any official agency. Each statement was voluntarily submitted and paid for by the candidate. Candidates who did not submit statements could otherwise be qualified to appear on the ballot. Candidates Governor Candidate Statements Lieutenant Governor Candidate Statements Secretary of State Candidate Statements Controller Candidate Statements Treasurer Candidate Statements Attorney General Candidate Statements Insurance Commissioner Candidate Statements Board of Equalization Candidate Statements Superintendent of Public Instruction Candidate Statements Voter Information Guide American Sign Language PDF Version English Español 中文 / Chinese हिन्दी / Hindi 日本語 / Japanese ខ្មែរ / Khmer 한국어 / Korean Tagalog ภาษาไทย/ Thai Tiếng Việt / Vietnamese Audio Versions Contact Us\nLinked source navigation (discovery only):\nSkip to Main Content => https://voterguide.sos.ca.gov/candidates/governor-candidate-statements.htm#mainCont\nSecretary of State Main Website => https://www.sos.ca.gov/\nElections & Voter Information => https://www.sos.ca.gov/elections\nHome => https://voterguide.sos.ca.gov/\nPropositions => https://voterguide.sos.ca.gov/propositions/\nCandidates => https://voterguide.sos.ca.gov/candidates/\nJustices => https://voterguide.sos.ca.gov/justices/\nQuick Reference Guide => https://voterguide.sos.ca.gov/quick-reference-guide/\nVoter Information => https://voterguide.sos.ca.gov/voter-info/\nAudio/PDF/Large Print => https://voterguide.sos.ca.gov/en/alt-versions/\nHome => https://voterguide.sos.ca.gov/\nCandidates => https://voterguide.sos.ca.gov/candidates/\nBack to the Top => https://voterguide.sos.ca.gov/candidates/governor-candidate-statements.htm#top\nCandidates => https://voterguide.sos.ca.gov/candidates/\nGovernor Candidate Statements => https://voterguide.sos.ca.gov/candidates/governor-candidate-statements.htm\nLieutenant Governor Candidate Statements => https://voterguide.sos.ca.gov/candidates/lt-governor-candidate-statements.htm\nSecretary of State Candidate Statements => https://voterguide.sos.ca.gov/candidates/sos-candidate-statements.htm\nController Candidate Statements => https://voterguide.sos.ca.gov/candidates/controller-candidate-statements.htm\nTreasurer Candidate Statements => https://voterguide.sos.ca.gov/candidates/treasurer-candidate-statements.htm\nAttorney General Candidate Statements => https://voterguide.sos.ca.gov/candidates/attorney-general-candidate-statements.htm\nInsurance Commissioner Candidate Statements => https://voterguide.sos.ca.gov/candidates/insurance-commissioner-candidate-statements.htm\nBoard of Equalization Candidate Statements => https://voterguide.sos.ca.gov/candidates/boe-candidate-statements.htm\nSuperintendent of Public Instruction Candidate Statements => https://voterguide.sos.ca.gov/candidates/superintendent-candidate-statements.htm\nAmerican Sign Language => https://voterguide.sos.ca.gov/asl/\nEnglish => https://vig.cdn.sos.ca.gov/2026/general/pdf/complete-vig.pdf\nEspañol => https://vig.cdn.sos.ca.gov/2026/general/es/pdf/complete-vig.pdf\n中文 / Chinese => https://vig.cdn.sos.ca.gov/2026/general/ch/pdf/complete-vig.pdf\nहिन्दी / Hindi => https://vig.cdn.sos.ca.gov/2026/general/hi/pdf/complete-vig.pdf\n日本語 / Japanese => https://vig.cdn.sos.ca.gov/2026/general/ja/pdf/complete-vig.pdf\nខ្មែរ / Khmer => https://vig.cdn.sos.ca.gov/2026/general/km/pdf/complete-vig.pdf\n한국어 / Korean => https://vig.cdn.sos.ca.gov/2026/general/ko/pdf/complete-vig.pdf\nTagalog => https://vig.cdn.sos.ca.gov/2026/general/tl/pdf/complete-vig.pdf\nภาษาไทย/ Thai => https://vig.cdn.sos.ca.gov/2026/general/th/pdf/complete-vig.pdf\nTiếng Việt / Vietnamese => https://vig.cdn.sos.ca.gov/2026/general/vi/pdf/complete-vig.pdf\nAudio Versions => https://voterguide.sos.ca.gov/en/alt-versions/\nContact Us => https://voterguide.sos.ca.gov/voter-info/contact-us.htm\nSecretary of State Main Website => https://www.sos.ca.gov/\nElections & Voter Information => https://www.sos.ca.gov/elections\nFind Your Polling Place => https://www.sos.ca.gov/elections/polling-place\nPropositions => https://voterguide.sos.ca.gov/propositions/\nCandidates => https://voterguide.sos.ca.gov/candidates/\nJustices => https://voterguide.sos.ca.gov/justices/\nQuick Reference Guide => https://voterguide.sos.ca.gov/quick-reference-guide/\nVoter Information => https://voterguide.sos.ca.gov/voter-info/\nAudio/PDF/Large Print => https://voterguide.sos.ca.gov/en/alt-versions/\nCampaign publisher disclosure (identity only):\n",
    contentHash:
      "602986d0f25c7e48db105dd986e0baff8608c8618f5995eb4380136b773489ae",
    byteHash:
      "23a52d40b8bf74595dd1b978638b349b340ea29c3991fdf937ff76e844d31a49",
    fetchedAt: "2026-10-30T21:04:33.660Z",
    retrievalUrls: [
      "https://voterguide.sos.ca.gov/candidates/governor-candidate-statements.htm",
    ],
  };
  const incumbent: ResearchSource = {
    id: "source-11075f80fd11e1048f93c165",
    url: "https://www.gov.ca.gov/about/",
    publisher: "Official office responsibilities",
    format: "html",
    text: "Governor Gavin Newsom Gavin Newsom was elected as California’s 40th Governor on November 6, 2018. Gavin Newsom is the 40th Governor of California Born in 1967 in San Francisco, Governor Newsom attended Redwood High School and later Santa Clara University. After college, Newsom started a retail wine shop that grew into the PlumpJack Group, which managed restaurants, hotels, and wineries across California. Newsom’s first job in politics was on the San Francisco Parking and Traffic Commission, and later on the San Francisco Board of Supervisors. In 2003, Newsom became the youngest elected Mayor of San Francisco in a century. He brought same-sex marriage to the forefront of the national conversation, directing the city-county clerk to issue marriage licenses to thousands of same-sex couples. As he did in that historic moment, Governor Newsom has stood up for California’s values time and time again. He is committed to serving all Californians, building a government that is more efficient, more effective, and more responsive to the needs of all who call this state home. Since his earliest days as a local elected official, he has connected with people and communities across the state to better understand their unique challenges and advantages, and how to bring all our communities together for a stronger, more united California. Governor Newsom is leading the fight for our fundamental freedoms and protecting California’s unique spirit of innovation and entrepreneurship. From gun safety, reproductive rights, education and literacy, and climate action, California has enacted nation-leading policies under Governor Newsom, laying the foundation for a safer, brighter, and fairer future for all Californians. He has strengthened California’s economic foundation through significant investments in college and career education, apprenticeships, and skilled job training – ensuring our remarkable innovation economy is protected and nurtured. Governor Newsom is married to filmmaker Jennifer Siebel Newsom, the First Partner of California and a leader in efforts to make the Golden State a more equitable, healthier, and safer place for all. They have four children: Montana, Hunter, Brooklynn, and Dutch. Download a high-res portrait of the Governor here. First Partner Jennifer Siebel Newsom Governor’s cabinet\nLinked source navigation (discovery only):\nGovernor of California => https://www.gov.ca.gov/\nAbout => https://www.gov.ca.gov/about/\nPriorities => https://www.gov.ca.gov/priorities-and-progress/\nNews => https://www.gov.ca.gov/newsroom/\nJoin the Administration => https://www.gov.ca.gov/join-the-administration/\nFirst Partner => https://www.gov.ca.gov/about/first-partner/\nContact => https://www.gov.ca.gov/contact/\nCA.gov => https://www.ca.gov/\nHealth insurance or Medi-Cal => https://www.coveredca.com/\nBusiness licenses => https://www.cdtfa.ca.gov/services/#Register-Renewals\nFood & social assistance => https://benefitscal.com/\nFind a CA state job => https://calcareers.ca.gov/\nVehicle registration => https://www.dmv.ca.gov/portal/vehicle-registration/vehicle-registration-renewal/\nDigital vaccine record => https://myvaccinerecord.cdph.ca.gov/\nTraffic tickets => https://www.ca.gov/service/?item=traffic-tickets\nBirth certificates => https://www.cdph.ca.gov/Programs/CHSI/Pages/Vital-Records-Obtaining-Certified-Copies-of-Birth-Records.aspx\nLottery numbers => https://www.calottery.com/draw-games\nUnemployment => https://edd.ca.gov/en/Unemployment/UI_Online\nView all CA.gov services => https://www.ca.gov/services/\nAbortion => https://abortion.ca.gov/\nBuilding California => https://build.ca.gov/\nClimate Action => https://climateaction.ca.gov/\nGun Safety => https://www.caloes.ca.gov/gunsafety/\nMental health care for all => https://mentalhealth.ca.gov/\nOpioids => https://www.cdph.ca.gov/Programs/CCDPHP/opioids/Pages/landingpage.aspx\nhere => https://www.gov.ca.gov/wp-content/uploads/2026/03/OFFICIAL-PORTRAIT.jpg\nFirst Partner Jennifer Siebel Newsom => https://www.gov.ca.gov/first-partner/\nGovernor’s cabinet => https://www.gov.ca.gov/about/cabinet/\nContact us => https://www.gov.ca.gov/contact/\nSign up for news updates => https://www.gov.ca.gov/newsroom/#updates\nJoin the Administration => https://www.gov.ca.gov/join-the-administration/\nOrganizational chart => https://www.gov.ca.gov/about/orgchart/\nAbortion access => https://abortion.ca.gov/\nAccountability => https://accountability.ca.gov/\nBuilding California's future => https://build.ca.gov/\nClimate action => https://climateaction.ca.gov/\nMental health for all => https://mentalhealth.ca.gov/\nHeat Ready => https://heatreadyca.com/\nReady for Wildfire => https://readyforwildfire.org/\nRegister to Vote => https://registertovote.ca.gov/\nSave Our Water => https://saveourwater.com/\nClemency => https://www.gov.ca.gov/clemency/\nParole => https://www.gov.ca.gov/clemency/parole/\nRewards for unsolved cases => https://www.gov.ca.gov/clemency/rewards-for-unsolved-crimes/\nConditions of Use => https://www.gov.ca.gov/conditions-of-use/\nPrivacy Policy => https://www.gov.ca.gov/privacy-policy/\nAccessibility => https://www.gov.ca.gov/accessibility/\nWebsite Certification => https://www.gov.ca.gov/wp-content/uploads/2025/06/SIMM-25B-Web-Accessibility-Certificate_Gov.CA_.GOV-Signed.pdf\nSitemap => https://www.gov.ca.gov/sitemap/\nCampaign publisher disclosure (identity only):\n",
    contentHash:
      "2b8a141f793ee27ad8b8babd512e3d808a312a94743a959c459fb9fd8d3e5204",
    byteHash:
      "d073339af5d7ff1f5b95cf25a51399687e1b383a5513f96be25d42054502c5d6",
    fetchedAt: "2026-10-30T21:04:29.011Z",
    retrievalUrls: ["https://www.gov.ca.gov/about/"],
  };
  const expected =
    "As the state's chief executive officer, oversees most state departments and agencies, and appoints judges. Proposes new laws, approves or vetoes legislation, and submits the annual state budget to the Legislature. Mobilizes and directs state resources during emergencies.";
  assert.equal(
    guide.contentHash,
    createHash("sha256").update(guide.text).digest("hex"),
  );
  const { snapshot, race } = await fixture();
  assert.equal(race.office, "Governor");
  const member = race.members.find(
    (candidate) => candidate.name === "Steve Hilton",
  )!;
  for (const useBiography of [false, true]) {
    const urls: string[] = [];
    const dossier = await collectCaliforniaEvidence(
      { snapshot, race, member },
      {
        now: () => now,
        sharedSources: new Map(),
        budget: { request() {}, bytes() {} },
        search: async () => ({ sources: [] }),
        fetch: async (id, url) => {
          urls.push(url);
          return url === guide.url
            ? useBiography
              ? { ...incumbent, id, url }
              : guide
            : source(
                id,
                url,
                "Official contact source with no campaign website or candidate-specific statement.",
              );
        },
      },
    );
    assert.ok(urls.includes(guide.url));
    assert.equal(urls.includes(incumbent.url), false);
    const authority = dossier.evidence.find(
      (entry) => entry.role === "office_authority",
    );
    if (useBiography) {
      assert.equal(authority, undefined);
      assert.ok(
        dossier.gaps.some(
          (gap) => gap.dimension === "mechanisms" && gap.required,
        ),
      );
    } else {
      assert.ok(authority);
      assert.equal(authority.origin, "primary_record");
      assert.equal(authority.excerpt, expected);
      assert.equal(authority.excerpt.includes("Xavier Becerra"), false);
      assert.equal(authority.excerpt.includes("Steve Hilton"), false);
      assert.equal(authority.excerpt.includes("Gavin Newsom"), false);
      assert.equal(authority.attribution, undefined);
      const archived = dossier.sources.find(
        (entry) => entry.id === authority.sourceId,
      )!;
      assert.equal(archived.contentHash, guide.contentHash);
      assert.equal(archived.fetchedAt, "2026-10-30T21:04:33.660Z");
      assert.equal(
        dossier.evidence.some(
          (entry) =>
            entry.role === "candidate_statement" &&
            entry.excerpt.includes(expected),
        ),
        false,
      );
    }
  }
});

test("candidate discovery searches the full name without office, year or quotes", async () => {
  const { snapshot, race } = await fixture();
  const member = race.members[0]!;
  const queries: { query: string; discover: boolean }[] = [];
  await collectCaliforniaEvidence(
    { snapshot, race, member },
    {
      now: () => now,
      sharedSources: new Map(),
      budget: { request() {}, bytes() {} },
      search: async (query, discover) => {
        queries.push({ query, discover });
        return { sources: [] };
      },
      fetch: async (id, url) =>
        source(id, url, "No candidate evidence available."),
    },
  );
  assert.deepEqual(queries, [
    { query: member.name, discover: false },
    { query: member.name, discover: true },
  ]);
});

test("McGuire's archived block footer qualifies the filed campaign and its actual about page", async () => {
  const { snapshot } = await fixture();
  const race = snapshot.races.find((target) =>
    target.members.some((member) => member.name === "Mike McGuire"),
  )!;
  const member = race.members.find(
    (candidate) => candidate.name === "Mike McGuire",
  )!;
  const root = "https://www.votemikemcguire.com/";
  const pages = new Map(
    await Promise.all(
      [
        [root, "mcguire-root-regression.txt"],
        [`${root}about`, "mcguire-about-regression.txt"],
      ].map(
        async ([url, file]) =>
          [
            url!,
            await readFile(
              new URL(`./fixtures/${file}`, import.meta.url),
              "utf8",
            ),
          ] as const,
      ),
    ),
  );
  const fetched: string[] = [];
  const dossier = await collectCaliforniaEvidence(
    { snapshot, race, member },
    {
      now: () => now,
      sharedSources: new Map(),
      budget: { request() {}, bytes() {} },
      search: async () => ({ sources: [] }),
      fetch: async (id, url, publisher, format) => {
        fetched.push(url);
        const html = pages.get(url);
        if (!html)
          return source(
            id,
            url,
            url.includes("contact-list")
              ? `General Election - November 3, 2026\nOfficial Candidate Contact List\n${race.office}\n${member.name} ${member.party}\nWEBSITE: ${root}\n${race.members.find((other) => other.name !== member.name)!.name} ${race.members.find((other) => other.name !== member.name)!.party}`
              : "Official office responsibilities.",
          );
        return fetchBoundedCaliforniaSource(
          id,
          url,
          publisher,
          format,
          { request() {}, bytes() {} },
          undefined,
          {
            addresses: async () => [{ address: "93.184.216.34", family: 4 }],
            transport: async () => new Response(html),
          },
        ).then((archive) => ({ ...archive, fetchedAt: now }));
      },
    },
  );
  assert.ok(
    fetched.includes(`${root}about`),
    "verified campaign must reach its substantive about page",
  );
  const archive = dossier.sources.find((entry) => entry.url === root)!;
  assert.ok(archive.text.includes("\nPaid for by Mike McGuire for Congress"));
  const about = dossier.sources.find((entry) => entry.url === `${root}about`)!;
  const evidence = dossier.evidence.find(
    (entry) =>
      entry.sourceId === about.id && entry.role === "campaign_material",
  );
  assert.ok(evidence, "actual campaign biography supplies record evidence");
  assert.equal(evidence.origin, "candidate");
  assert.equal(evidence.attribution?.status, "unresolved");
  assert.ok(about.text.includes(evidence.excerpt));
  assert.ok(
    dossier.sourceLinks?.some(
      (link) =>
        link.fromSourceId === archive.id &&
        link.toSourceId === about.id &&
        link.relation === "same_origin_campaign",
    ),
  );
});

test("county education authority accepts the current county roster office order without swallowing Equalization", () => {
  assert.equal(
    californiaLocalAuthority({
      office: "Board of Education, Area 7",
      jurisdictionLabel: "Santa Clara County",
    })?.id,
    "county-education-board",
  );
  assert.equal(
    californiaLocalAuthority({
      office: "Board of Education, Area 7",
      jurisdictionLabel: "Example School District",
    })?.id,
    "school-district-board",
  );
  assert.equal(
    californiaLocalAuthority({
      office: "Board of Equalization, District 2",
      jurisdictionLabel: "California",
    }),
    null,
  );
});

test("verified current House office records retain exact name and district without future-election prose", async () => {
  const { snapshot } = await fixture();
  const race = snapshot.races.find((target) =>
    target.members.some((member) => member.name === "Ro Khanna"),
  )!;
  const text =
    "Congressman Ro Khanna represents California's 17th Congressional District. He has worked to expand public services and support families through legislation.";
  assert.equal(
    qualifiedCandidatePage(
      source("khanna", "https://khanna.house.gov/about", text),
      race,
      "Ro Khanna",
      false,
    ),
    true,
  );
  for (const [url, body] of [
    ["https://other.house.gov/about", text.replace("17th", "18th")],
    ["https://unrelated.gov/about", text],
    ["https://other.house.gov/about", text],
    ["http://khanna.house.gov/about", text],
    ["https://khanna.house.gov/news/endorsement", text],
    ["https://khanna.house.gov/about", text.replace("Congressman", "Reporter")],
    ["https://khanna.house.gov/about", text.replace("California", "Ohio")],
    ["https://khanna.house.gov/about", text.replace("17th", "170th")],
    [
      "https://khanna.house.gov/about",
      text.replace("Ro Khanna", "Ro Khanna Jr."),
    ],
    ["https://example.org/about", text],
    [
      "https://khanna.house.gov/about",
      "Ro Khanna worked to expand public services.",
    ],
  ])
    assert.equal(
      qualifiedCandidatePage(
        source("rejected", url!, body!),
        race,
        "Ro Khanna",
        false,
      ),
      false,
      `${url} ${body}`,
    );
});

test("partial source body failure preserves the acquisition cause and canonical URL", async () => {
  const network = Object.assign(new Error("aborted"), { code: "ECONNRESET" });
  await assert.rejects(
    () =>
      fetchBoundedCaliforniaSource(
        "required",
        "https://county.example.gov/roster",
        "County",
        "text",
        { request() {}, bytes() {} },
        undefined,
        {
          addresses: async () => [{ address: "93.184.216.34", family: 4 }],
          transport: async () =>
            new Response(
              new ReadableStream({
                start(controller) {
                  controller.error(network);
                },
              }),
            ),
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "CaliforniaSourceUnavailable");
      assert.equal(error.cause, network);
      assert.match(error.message, /https:\/\/county\.example\.gov\/roster/);
      return true;
    },
  );
});

test("native interrupted source response is an acquisition outage rather than a completed archive", async (t) => {
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      "Content-Type": "text/plain",
      "Content-Length": "100000",
    });
    response.write("Partial authoritative source bytes.");
    setImmediate(() => response.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://county.example.gov:${address.port}/roster`;
  await assert.rejects(
    () =>
      fetchBoundedCaliforniaSource(
        "required",
        url,
        "County",
        "text",
        { request() {}, bytes() {} },
        undefined,
        {
          addresses: async () => [{ address: "127.0.0.1", family: 4 }],
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, "CaliforniaSourceUnavailable");
      assert.ok(error.cause instanceof Error);
      assert.equal((error.cause as NodeJS.ErrnoException).code, "ECONNRESET");
      assert.ok(error.message.includes(url));
      return true;
    },
  );
});

async function capturedHouseCampaign(name: string) {
  const { snapshot } = await fixture();
  const race = snapshot.races.find(
    (target) =>
      target.officeFamily === "us_house" &&
      target.members.some((candidate) => candidate.name === name),
  )!;
  const member = race.members.find((candidate) => candidate.name === name)!;
  const archive = JSON.parse(
    await readFile(
      new URL(
        "./fixtures/three-district-campaign-sources.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { sources: ResearchSource[] };
  const sources = structuredClone(archive.sources);
  const fetched: string[] = [];
  const deps = {
    now: () => now,
    sharedSources: new Map<string, Promise<ResearchSource>>(),
    budget: { request() {}, bytes() {} },
    search: async () => ({ sources: [] }),
    fetch: async (id: string, url: string) => {
      fetched.push(url);
      const found = sources.find(
        (entry) => entry.url === url || entry.retrievalUrls?.[0] === url,
      );
      if (found) return { ...found, id };
      if (url === "https://www.house.gov/the-house-explained")
        return source(
          id,
          url,
          "Representatives introduce bills and resolutions, offer amendments and serve on committees.",
        );
      throw new Error("No captured source for this offline replay");
    },
  };
  return { snapshot, race, member, sources, deps, fetched };
}

for (const name of [
  "Peter Coe Verbica",
  "Jimmy Panetta",
  "Mark DeSaulnier",
  "Jeff Frese",
  "Peter Sundin Soulé",
]) {
  test(`current SOS contact qualifies the captured ${name} campaign without inventing a personal speaker`, async () => {
    const f = await capturedHouseCampaign(name);
    const dossier = await collectCaliforniaEvidence(f, f.deps);
    assert.equal(dossier.classification, "supported");
    const evidence = dossier.evidence.find(
      (entry) => entry.role === "campaign_material",
    );
    assert.ok(evidence, "actual platform must become available to the author");
    assert.equal(evidence.identityQualification, "official_cross_link");
    assert.equal(evidence.attribution?.status, "unresolved");
    const page = dossier.sources.find(
      (entry) => entry.id === evidence.sourceId,
    )!;
    assert.equal(
      evidence.attribution.context.excerpt,
      page.text.split("\nLinked source navigation (discovery only):\n")[0],
    );
    assert.ok(
      dossier.sourceLinks?.some(
        (link) =>
          link.relation === "official_contact" && link.toSourceId === page.id,
      ),
    );
    assert.ok(evidence.excerpt.length >= 180);
    if (name === "Jeff Frese") {
      assert.ok(
        evidence.excerpt.includes(
          "Ban members of Congress from trading stocks",
        ),
      );
      assert.equal(evidence.excerpt.includes("Text Message Terms"), false);
    }
  });
}

for (const [label, mutate] of [
  [
    "wrong election",
    (text: string) =>
      text.replaceAll(
        "General Election - November 3, 2026",
        "General Election - November 5, 2024",
      ),
  ],
  [
    "wrong district",
    (text: string) =>
      text.replace(
        "United States Representative District 19",
        "United States Representative District 190",
      ),
  ],
  [
    "duplicate candidate",
    (text: string) =>
      text.replace(
        "Peter Coe Verbica Republican",
        "Peter Coe Verbica Republican\nPeter Coe Verbica Republican",
      ),
  ],
  [
    "missing website",
    (text: string) =>
      text.replace(
        "WEBSITE: www.peterverbica.com",
        "CAMPAIGN: www.peterverbica.com",
      ),
  ],
  [
    "two websites",
    (text: string) =>
      text.replace(
        "WEBSITE: www.peterverbica.com",
        "WEBSITE: www.peterverbica.com\nWEBSITE: www.other.example",
      ),
  ],
  [
    "neighbor website",
    (text: string) =>
      text.replace(
        "WEBSITE: www.peterverbica.com",
        "WEBSITE: www.jimmypanetta.com",
      ),
  ],
] as const) {
  test(`current SOS campaign identity rejects ${label}`, async () => {
    const f = await capturedHouseCampaign("Peter Coe Verbica");
    const contact = f.sources.find((entry) =>
      entry.url.endsWith("contact-list.pdf"),
    )!;
    contact.text = mutate(contact.text);
    contact.contentHash = createHash("sha256")
      .update(contact.text)
      .digest("hex");
    const dossier = await collectCaliforniaEvidence(f, f.deps);
    assert.equal(
      dossier.evidence.some((entry) => entry.role === "campaign_material"),
      false,
    );
  });
}

for (const [label, body] of [
  ["conflicting middle name", "Peter Other Soulé"],
  ["conflicting suffix", "Peter Soule Jr."],
  ["unrelated candidate", "Another Candidate"],
] as const) {
  test(`current SOS contact does not rescue a ${label} on its destination`, async () => {
    const f = await capturedHouseCampaign("Peter Sundin Soulé");
    const page = f.sources.find(
      (entry) => entry.url === "https://souleforcongress.com/",
    )!;
    page.text =
      `${body} will support public services and reduce unnecessary costs. `.repeat(
        8,
      );
    page.contentHash = createHash("sha256").update(page.text).digest("hex");
    const dossier = await collectCaliforniaEvidence(f, f.deps);
    assert.equal(
      dossier.evidence.some((entry) => entry.role === "campaign_material"),
      false,
    );
  });
}

test("current SOS contact rejects an unrelated intermediate redirect even when the final publisher matches", async () => {
  const f = await capturedHouseCampaign("Peter Coe Verbica");
  const page = f.sources.find(
    (entry) => entry.url === "https://peterverbica.com/",
  )!;
  page.retrievalUrls = [
    "https://www.peterverbica.com/",
    "https://unrelated.example/",
    page.url,
  ];
  const dossier = await collectCaliforniaEvidence(f, f.deps);
  assert.equal(
    dossier.evidence.some((entry) => entry.role === "campaign_material"),
    false,
  );
});

test("official House short district identity is attached to the exact named representative", async () => {
  const f = await capturedHouseCampaign("Jimmy Panetta");
  const actual = f.sources.find(
    (entry) => entry.url === "https://panetta.house.gov/",
  )!;
  assert.equal(
    qualifiedCandidatePage(actual, f.race, f.member.name, false),
    true,
  );
  for (const text of [
    "United States Representative Jimmy Panetta (CA-190)",
    "United States Representative Jimmy Panetta (CA-18)",
    "United States Representative Other Person (CA-19). Jimmy Panetta.",
    "United States Representative Jimmy Panetta (OH-19)",
  ]) {
    assert.equal(
      qualifiedCandidatePage(
        source("negative", actual.url, text),
        f.race,
        f.member.name,
        false,
      ),
      false,
      text,
    );
  }
  assert.equal(
    qualifiedCandidatePage(
      { ...actual, url: "https://panetta.house.gov.evil.example/" },
      f.race,
      f.member.name,
      false,
    ),
    false,
  );
});

test("the last House contact row stops before the captured State Senate section", async () => {
  const f = await capturedHouseCampaign("Jeff Belle");
  const url = "https://www.belleforcongress.com/";
  const text =
    "Jeff Belle will support public services and reduce unnecessary costs through published budget proposals. ".repeat(
      5,
    );
  f.sources.push({ ...source("last-house", url, text), retrievalUrls: [url] });
  const dossier = await collectCaliforniaEvidence(f, f.deps);
  assert.equal(dossier.classification, "supported");
  assert.ok(f.fetched.includes(url));
  assert.equal(
    f.fetched.some((value) => /damonconnolly|tief4casenate/.test(value)),
    false,
  );
});

test("a current campaign redirect cannot switch to another HTTPS service on the same host", async () => {
  const f = await capturedHouseCampaign("Peter Coe Verbica");
  const page = f.sources.find(
    (entry) => entry.url === "https://peterverbica.com/",
  )!;
  page.retrievalUrls = [
    "https://www.peterverbica.com/",
    "https://peterverbica.com:8443/",
    page.url,
  ];
  const dossier = await collectCaliforniaEvidence(f, f.deps);
  assert.equal(
    dossier.evidence.some((entry) => entry.role === "campaign_material"),
    false,
  );
});

test("explicit finance refresh rechecks uncited nonfinancial archives without repeating discovery", async () => {
  const f = await capturedHouseCampaign("Jeff Frese");
  const original = await collectCaliforniaEvidence(f, f.deps);
  const uncited = source(
    "uncited-context",
    "https://example.org/context",
    "Previously checked context.",
  );
  const feedUrl = "https://news.example.org/feed";
  const feed = {
    ...source(
      `source-${createHash("sha256").update(feedUrl).digest("hex").slice(0, 24)}`,
      feedUrl,
      "Old unrelated feed.",
    ),
    publisher: "news.example.org",
  };
  const previousDossier = buildCaliforniaDossier({
    ...original,
    sources: [...original.sources, uncited, feed],
  });
  const fetched: string[] = [];
  const refreshed = await collectCaliforniaEvidence(
    { ...f, previousDossier, researchScope: "finance_refresh" },
    {
      ...f.deps,
      sharedSources: new Map(),
      search: async () => {
        throw new Error("Finance refresh must not repeat campaign discovery");
      },
      fetch: async (id, url) => {
        fetched.push(url);
        const prior = previousDossier.sources.find((s) => s.url === url);
        if (prior) {
          const observed =
            url === feedUrl ? source(id, url, "Fresh unrelated feed.") : prior;
          return { ...observed, id, fetchedAt: "2026-10-31T00:00:00.000Z" };
        }
        return f.deps.fetch(id, url);
      },
      now: () => "2026-10-31T00:00:00.000Z",
    },
  );
  assert(fetched.includes(uncited.url));
  assert.equal(
    refreshed.sources.find((s) => s.id === feed.id)?.text,
    "Fresh unrelated feed.",
  );
  assert.equal(
    refreshed.sources.find((s) => s.id === uncited.id)?.fetchedAt,
    "2026-10-31T00:00:00.000Z",
  );
  assert.deepEqual(
    refreshed.evidence.filter((e) => e.role !== "finance"),
    previousDossier.evidence.filter((e) => e.role !== "finance"),
  );
  assert.deepEqual(refreshed.sourceLinks, previousDossier.sourceLinks);
  await assert.rejects(
    collectCaliforniaEvidence(
      { ...f, previousDossier, researchScope: "finance_refresh" },
      {
        ...f.deps,
        sharedSources: new Map(),
        fetch: async (id, url) => {
          const prior = previousDossier.sources.find((s) => s.url === url);
          if (prior)
            return url === uncited.url
              ? source(id, url, "Changed contextual archive.")
              : { ...prior, id };
          return f.deps.fetch(id, url);
        },
      },
    ),
    CaliforniaCitedSourceFailure,
  );
});

test("failed transport diagnostics identify only the public resource and numeric retry delay", async () => {
  await assert.rejects(
    fetchBoundedCaliforniaSource(
      "rate-limited",
      "https://api.open.fec.gov/v1/filings/?api_key=not-for-logs&cycle=2026",
      "Federal Election Commission",
      "json",
      { request() {}, bytes() {} },
      undefined,
      {
        addresses: async () => [{ address: "93.184.216.34", family: 4 }],
        transport: async () =>
          new Response("private response", {
            status: 429,
            headers: { "retry-after": "90" },
          }),
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof CaliforniaSourceHttpError);
      assert.equal(error.status, 429);
      assert.equal(error.resource, "https://api.open.fec.gov/v1/filings/");
      assert.equal(error.retryAfterSeconds, 90);
      assert.equal(error.message.includes("not-for-logs"), false);
      assert.equal(error.message.includes("private response"), false);
      return true;
    },
  );
});

test("captured Bonta footer preserves a genuine disclosure after a contraction", async () => {
  const footer = await readFile(
    new URL("./fixtures/bonta-campaign-footer.html", import.meta.url),
    "utf8",
  );
  assert.match(footer, /you(?:'|’)ve/);
  const archive = await fetchBoundedCaliforniaSource(
    "campaign",
    "https://robbonta.com/",
    "robbonta.com",
    "html",
    { request() {}, bytes() {} },
    undefined,
    {
      addresses: async () => [{ address: "93.184.216.34", family: 4 }],
      transport: async () =>
        new Response(
          `<html><body><main>Rob Bonta</main>${footer}</body></html>`,
        ),
    },
  );
  const [substantive, disclosure] = archive.text.split(
    "\nCampaign publisher disclosure (identity only):\n",
  );
  assert.match(
    disclosure!,
    /Paid for by Rob Bonta for CA Attorney General 2026/,
  );
  assert.equal(
    substantive!
      .split("\nLinked source navigation (discovery only):\n")[0]!
      .includes("Paid for by"),
    false,
  );
});

test("captured statewide authority pages require their office provision and reject missing-page content", async () => {
  const pages = JSON.parse(
    await readFile(
      new URL("./fixtures/statewide-authority-pages.json", import.meta.url),
      "utf8",
    ),
  ) as { office: string; url: string; text?: string; html?: string }[];
  const { snapshot } = await fixture();
  for (const page of pages) {
    const race = snapshot.races.find(
      (target) => target.office === page.office,
    )!;
    assert.ok(race, page.office);
    const member = race.members[0]!;
    const variants = [
      "actual",
      "wrong-office",
      "soft404",
      "truncated",
      ...(page.office === "Superintendent of Public Instruction"
        ? ["candidate-quotation"]
        : []),
    ];
    for (const variant of variants) {
      const dossier = await collectCaliforniaEvidence(
        { snapshot, race, member },
        {
          now: () => now,
          sharedSources: new Map(),
          budget: { request() {}, bytes() {} },
          search: async () => ({ sources: [] }),
          fetch: async (id, url, publisher, format) => {
            if (url !== page.url)
              return source(
                id,
                url,
                "Official source without a listed candidate statement or campaign website.",
              );
            const actual =
              page.html ??
              `<html><body><main>${page.text}</main></body></html>`;
            const html =
              variant === "actual"
                ? actual
                : variant === "wrong-office"
                  ? "<html><main>The mayor administers the city budget and oversees municipal departments.</main></html>"
                  : variant === "soft404"
                    ? `<html><main>The page you requested is not found. ${page.text ?? ""}</main></html>`
                    : variant === "candidate-quotation"
                      ? `<html><main>${member.name} says: ${page.text ?? ""}</main></html>`
                      : `<html><main>${(page.text ?? "").slice(0, 150)}</main></html>`;
            return fetchBoundedCaliforniaSource(
              id,
              url,
              publisher,
              format,
              { request() {}, bytes() {} },
              undefined,
              {
                addresses: async () => [
                  { address: "93.184.216.34", family: 4 },
                ],
                transport: async () => new Response(html),
              },
            ).then((archive) => ({ ...archive, fetchedAt: now }));
          },
        },
      );
      const authority = dossier.evidence.find(
        (entry) => entry.role === "office_authority",
      );
      if (variant === "actual") {
        assert.ok(authority, page.office);
        const observed = dossier.sources.find(
          (entry) => entry.id === authority.sourceId,
        )!;
        assert.ok(observed.text.includes(authority.excerpt));
        assert.doesNotMatch(
          authority.excerpt,
          /page you requested is not found/i,
        );
        if (page.office === "Superintendent of Public Instruction") {
          assert.match(authority.excerpt, /governing boards/);
          assert.doesNotMatch(authority.excerpt, /Richard Barrera|Sonja Shaw/);
        }
      } else {
        assert.equal(authority, undefined, `${page.office}: ${variant}`);
        assert.ok(
          dossier.gaps.some(
            (gap) => gap.dimension === "mechanisms" && gap.required,
          ),
        );
      }
    }
  }
});
