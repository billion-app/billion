import assert from "node:assert/strict";
import test from "node:test";

import type { ResearchSource } from "@acme/validators";
import { campaignBrowserContract } from "@acme/validators";

import {
  currentCampaignContactUrl,
  currentGovernorContact,
  qualifiedPartyListUrl,
  qualifiedPartyRegistryUrl,
  qualifiedPartyWebsite,
} from "../campaign-ownership";
import {
  campaignArchiveHash,
  campaignRenderSemanticDigest,
  encodeCampaignRenderSources,
  validateCampaignRenderArchive,
  validateCampaignRenderSources,
} from "../campaign-render-archive";
import { formatCampaignHtml } from "../campaign-source-html";

function must<T>(value: T | undefined | null): T {
  assert.ok(value !== undefined && value !== null);
  return value;
}
const time = "2026-01-01T00:00:00.000Z";
const body =
  "Our plan improves housing affordability by building homes near jobs and speeding permit review. We will publish state spending and provide schools the support they need to teach reading and mathematics. California families deserve dependable services and transparent decisions.";
function archive() {
  const html = `<main><h1>Candidate for Governor 2026</h1> <p>${body}</p> </main><footer>Paid for by Example Candidate for Governor 2026</footer>`;
  const raw = Buffer.from(
    '<html><script type="module" src="/app.js"></script><div id="root"></div></html>',
  );
  const hash = campaignArchiveHash(raw);
  return {
    version: 1 as const,
    kind: "network_none_campaign_archive" as const,
    candidateId: "example",
    ownershipDigest: "a".repeat(64),
    origin: "https://campaign.example",
    requestedUrl: "https://campaign.example/",
    renderer: {
      ...campaignBrowserContract,
      browserVersion: "145.0.7632.0",
      sandbox:
        "Layer 1 Sandbox Namespace\nPID namespaces Yes\nNetwork namespaces Yes\nSeccomp-BPF sandbox Yes",
    },
    initialResponseCount: 1,
    responses: [
      {
        url: "https://campaign.example/",
        status: 200,
        mime: "text/html",
        location: null,
        kind: "document" as const,
        bodyHash: hash,
        bodyBytes: raw.length,
        startedAt: time,
        completedAt: time,
      },
    ],
    bodies: { [hash]: raw.toString("base64") },
    pages: [
      {
        url: "https://campaign.example/",
        initialBodyHash: hash,
        domHtml: html,
        evidenceDomHtml: html,
        visibleText: `Candidate for Governor 2026 ${body} Paid for by Example Candidate for Governor 2026`,
        capturedAt: time,
        mainObservations: [
          {
            text: `Candidate for Governor 2026 ${body}`,
            scrollY: 0,
            capturedAt: time,
          },
        ],
      },
    ],
    blocked: [],
  };
}
void test("rendered evidence replays shared compressed raw archive; HTTP shell alone is not substantive", () => {
  const value = archive();
  assert.equal(
    formatCampaignHtml(
      Buffer.from(must(Object.values(value.bodies)[0]), "base64").toString(),
      value.requestedUrl,
    ).substantive,
    "",
  );
  const sources = encodeCampaignRenderSources(value);
  validateCampaignRenderSources(sources, {
    candidateId: "example",
    ownershipDigest: "a".repeat(64),
  });
  assert.ok(Buffer.byteLength(JSON.stringify(sources)) < 2_000_000);
  const changed = structuredClone(sources);
  must(changed[1]).text += " invented claim";
  assert.throws(() => validateCampaignRenderSources(changed));
  assert.throws(() =>
    validateCampaignRenderSources(sources, {
      candidateId: "other",
      ownershipDigest: "a".repeat(64),
    }),
  );
  assert.throws(() => validateCampaignRenderSources(sources.slice(1)));
});
void test("clock and build metadata cannot invalidate political semantics; content changes do", () => {
  const first = archive(),
    later = structuredClone(first);
  must(later.responses[0]).startedAt = "2026-01-02T00:00:00.000Z";
  must(later.responses[0]).completedAt = must(later.responses[0]).startedAt;
  must(later.pages[0]).capturedAt = must(later.responses[0]).startedAt;
  must(must(later.pages[0]).mainObservations[0]).capturedAt = must(
    later.responses[0],
  ).startedAt;
  assert.equal(
    campaignRenderSemanticDigest(first),
    campaignRenderSemanticDigest(later),
  );
  must(later.pages[0]).evidenceDomHtml = must(
    later.pages[0],
  ).evidenceDomHtml.replace("housing", "healthcare");
  assert.notEqual(
    campaignRenderSemanticDigest(first),
    campaignRenderSemanticDigest(later),
  );
});
void test("raw hashes, visible DOM, clocks, MIME, origin and sandbox fail closed", () => {
  for (const mutate of [
    (v: ReturnType<typeof archive>) => {
      must(v.responses[0]).bodyHash = "b".repeat(64);
    },
    (v: ReturnType<typeof archive>) => {
      must(must(v.pages[0]).mainObservations[0]).text =
        "hidden invented text ".repeat(20);
    },
    (v: ReturnType<typeof archive>) => {
      must(v.pages[0]).capturedAt = "2999-01-01T00:00:00.000Z";
    },
    (v: ReturnType<typeof archive>) => {
      must(v.responses[0]).mime = "application/json";
    },
    (v: ReturnType<typeof archive>) => {
      must(v.responses[0]).url = "https://evil.example/";
    },
    (v: ReturnType<typeof archive>) => {
      v.renderer.sandbox = "No sandbox";
    },
  ]) {
    const value = archive();
    mutate(value);
    assert.throws(() => validateCampaignRenderArchive(value));
  }
});
void test("skipped offscreen speaker attribution cannot be labeled complete campaign context", () => {
  const value = archive();
  const page = must(value.pages[0]);
  page.evidenceDomHtml = page.evidenceDomHtml.replace(
    "</main>",
    "<blockquote>According to an independent organization, these are its priorities and are not the candidate's adopted positions.</blockquote></main>",
  );
  assert.throws(
    () => validateCampaignRenderArchive(value),
    /complete observed main context/,
  );
  page.mainObservations.push({
    text: "According to an independent organization, these are its priorities and are not the candidate's adopted positions.",
    scrollY: 600,
    capturedAt: time,
  });
  validateCampaignRenderArchive(value);
});

void test("observed speaker attribution cannot disappear from retained evidence DOM", () => {
  const value = archive();
  const page = must(value.pages[0]);
  const attribution =
    "According to an independent organization, these are its priorities and are not adopted by the candidate.";
  page.domHtml = page.domHtml.replace(
    "</main>",
    `<p aria-hidden="true">${attribution}</p></main>`,
  );
  page.mainObservations.push({
    text: attribution,
    scrollY: 600,
    capturedAt: time,
  });
  assert.throws(
    () => validateCampaignRenderArchive(value),
    /complete observed main context/,
  );
  page.evidenceDomHtml = page.evidenceDomHtml.replace(
    "</main>",
    `<p aria-hidden="true">${attribution}</p></main>`,
  );
  validateCampaignRenderArchive(value);
});

function source(id: string, url: string, html: string): ResearchSource {
  const bytes = Buffer.from(html);
  return {
    id,
    url,
    publisher: "test fixture",
    format: "html",
    text: formatCampaignHtml(html, url).text,
    contentHash: campaignArchiveHash(formatCampaignHtml(html, url).text),
    byteHash: campaignArchiveHash(bytes),
    binaryBase64: bytes.toString("base64"),
    fetchedAt: time,
    httpObservation: {
      kind: "campaign_http_document_v1",
      responses: [
        {
          url,
          status: 200,
          mime: "text/html",
          location: null,
          bodyHash: campaignArchiveHash(bytes),
          bodyBytes: bytes.length,
          startedAt: time,
          completedAt: time,
        },
      ],
    },
  };
}
void test("party discovery binds exact official party, cycle, office and unique full-name anchor", () => {
  const registry = source(
    "registry",
    qualifiedPartyRegistryUrl,
    '<h2>Democratic Party</h2><ul><li><a href="http://www.cadem.org/">Website</a></li></ul><h2>Other</h2>',
  );
  const html =
    '<h1>2026 Endorsement Process</h1><h4>GOVERNOR</h4><p><a href="http://example-campaign.test">Example Candidate</a><a href="https://neighbor.test">Neighbor Person</a></p><h4>TREASURER</h4><p>Someone Else</p>';
  const list = source("list", qualifiedPartyListUrl, html);
  assert.equal(
    qualifiedPartyWebsite(registry, list, "Example Candidate").url,
    "http://example-campaign.test/",
  );
  for (const bad of [
    html.replace("GOVERNOR", "TREASURER"),
    html.replace("2026", "2028"),
    html.replace(
      "</p><h4>",
      '<a href="https://fake.test">Example Candidate</a></p><h4>',
    ),
  ])
    assert.throws(() =>
      qualifiedPartyWebsite(
        registry,
        source("list", qualifiedPartyListUrl, bad),
        "Example Candidate",
      ),
    );
  assert.throws(() =>
    qualifiedPartyWebsite(
      source(
        "registry",
        qualifiedPartyRegistryUrl,
        '<h2>Democratic Party</h2><p><a href="http://www.cadem.org.evil.test/">Website</a></p>',
      ),
      list,
      "Example Candidate",
    ),
  );
});
void test("current contact row boundaries preserve missing versus withheld and never borrow neighbor website", () => {
  const members = [
    { candidateId: "one", name: "Example Candidate", party: "Democratic" },
    { candidateId: "two", name: "Neighbor Person", party: "Republican" },
  ];
  const contact = {
    id: "contact",
    url: currentCampaignContactUrl,
    publisher: "SOS",
    format: "pdf" as const,
    text: "General Election - November 3, 2026\nOfficial Candidate Contact List\nGovernor\nExample Candidate Democratic\nEMAIL: example@example.test\nNeighbor Person Republican\nWEBSITE: www.neighbor.test\nLieutenant Governor\n",
    contentHash: "a".repeat(64),
    fetchedAt: time,
  };
  assert.equal(
    currentGovernorContact(contact, members, "one")?.status,
    "missing",
  );
  assert.equal(
    currentGovernorContact(contact, members, "two")?.status,
    "listed",
  );
  contact.text = contact.text.replace(
    "EMAIL: example@example.test",
    "WEBSITE: withheld",
  );
  assert.equal(
    currentGovernorContact(contact, members, "one")?.status,
    "withheld",
  );
});

void test("party-owned campaign proof rejects false legal ownership, quoted attribution and mutable raw provenance", async () => {
  const { validateCampaignOwnership } = await import("../campaign-ownership");
  const contestId = "ca-sos:2026-11-03:020000000000";
  const identity = {
    candidateId: contestId + ":1",
    contestId,
    electionDate: "2026-11-03",
    jurisdiction: "ocd-division/country:us/state:ca",
  };
  const contact: ResearchSource = {
    id: "contact",
    url: currentCampaignContactUrl,
    publisher: "SOS",
    format: "pdf",
    text: "General Election - November 3, 2026\nOfficial Candidate Contact List\nGovernor\nExample Candidate Democratic\nEMAIL: example@example.test\nNeighbor Person Republican\nWEBSITE: www.neighbor.test\nLieutenant Governor\n",
    contentHash: "a".repeat(64),
    fetchedAt: time,
  };
  const roster: ResearchSource = {
    id: "roster",
    url: "https://media.sos.ca.gov/media/C26GG.txt",
    publisher: "SOS",
    format: "text",
    text: "[C|CAS|2|020000000000|1||Candidate|Example||01|Example Candidate|]\n[C|CAS|3|020000000000|2||Person|Neighbor||02|Neighbor Person|]",
    contentHash: "a".repeat(64),
    fetchedAt: time,
  };
  const registry = source(
    "registry",
    qualifiedPartyRegistryUrl,
    '<h2>Democratic Party</h2><ul><li><a href="http://www.cadem.org/">Party Website</a></li></ul>',
  );
  const listHtml =
    '<h1>2026 Endorsement Process</h1><h4>GOVERNOR</h4><p><a href="https://campaign.example/">Example Candidate</a></p>';
  const list = source("list", qualifiedPartyListUrl, listHtml);
  const campaignHtml = `<main><h1>Example Candidate for Governor 2026</h1> <p>${body}</p></main><footer><p>Paid for by Candidate for Governor 2026</p></footer>`;
  const campaign = {
    ...source("campaign", "https://campaign.example/", campaignHtml),
    retrievalUrls: ["https://campaign.example/"],
  };
  const row = currentGovernorContact(
    contact,
    [
      {
        name: "Example Candidate",
        party: "Democratic",
        candidateId: identity.candidateId,
      },
      {
        name: "Neighbor Person",
        party: "Republican",
        candidateId: contestId + ":2",
      },
    ],
    identity.candidateId,
  );
  assert.ok(row);
  const proof = {
    kind: "qualified_party_campaign_v1" as const,
    currentContactSourceId: "contact",
    contactExcerpt: row.excerpt,
    registrySourceId: "registry",
    partyListSourceId: "list",
    partyName: "Democratic Party" as const,
    partyWebsiteAnchor: "http://www.cadem.org/" as const,
    candidateAnchor: "Example Candidate",
    listedUrl: "https://campaign.example/",
    destinationSourceId: "campaign",
    legalOwner: "Paid for by Candidate for Governor 2026",
  };
  const dossier = {
    identity,
    name: "Example Candidate",
    officeFamily: "statewide" as const,
    sources: [roster, contact, registry, list, campaign],
    campaignOwnershipProof: proof,
  };
  validateCampaignOwnership(dossier);
  const reject = (mutate: (d: typeof dossier) => void) => {
    const bad = structuredClone(dossier);
    mutate(bad);
    assert.throws(() => validateCampaignOwnership(bad));
  };
  reject((d) => {
    d.name = "Other Candidate";
  });
  reject((d) => {
    d.identity.electionDate = "2028-11-07";
  });
  reject((d) => {
    d.campaignOwnershipProof.legalOwner =
      "Paid for by Someone Else for Governor 2026";
  });
  reject((d) => {
    must(d.sources[0]).text = must(d.sources[0]).text.replace("||01|", "||02|");
  });
  reject((d) => {
    must(d.sources[1]).text = must(d.sources[1]).text.replace(
      "EMAIL: example@example.test",
      "WEBSITE: withheld",
    );
  });
  reject((d) => {
    d.sources[4] = {
      ...source(
        "campaign",
        "https://campaign.example/",
        campaignHtml
          .replace("<p>Paid for", "<blockquote>Paid for")
          .replace("2026</p></footer>", "2026</blockquote></footer>"),
      ),
      retrievalUrls: ["https://campaign.example/"],
    };
  });
  reject((d) => {
    d.sources[4] = {
      ...source(
        "campaign",
        "https://campaign.example/",
        campaignHtml.replace(
          "Paid for by Candidate",
          "Not authorized by Example Candidate. Paid for by Candidate",
        ),
      ),
      retrievalUrls: ["https://campaign.example/"],
    };
  });
  reject((d) => {
    must(d.sources[4]).byteHash = "b".repeat(64);
  });
  reject((d) => {
    must(must(must(d.sources[4]).httpObservation).responses[0]).status = 302;
  });
  reject((d) => {
    must(d.sources[4]).retrievalUrls = [
      "http://campaign.example/",
      "https://campaign.example/",
    ];
  });
  reject((d) => {
    must(d.sources[0]).text +=
      "\n[C|CAS|4|020000000000|3||Candidate|Other||01|Other Candidate|]";
  });
});
