import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { gunzipSync } from "node:zlib";
import { load } from "cheerio";

import type {
  CampaignOwnershipProof,
  CandidateEvidenceDossier,
  ResearchSource,
} from "@acme/validators";
import { campaignOwnershipProofSchema } from "@acme/validators";

import {
  campaignRenderArchiveSchema,
  formatRenderedCampaignHtml,
  validateCampaignRenderArchive,
} from "./campaign-render-archive";
import { formatCampaignHtml } from "./campaign-source-html";

export const currentCampaignContactUrl =
  "https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/contact-list.pdf";
export const qualifiedPartyRegistryUrl =
  "https://www.sos.ca.gov/elections/political-parties/qualified-political-parties";
export const qualifiedPartyListUrl =
  "https://cadem.org/endorsements/2026-list-of-candidates-who-have-filed/";
const digest = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const literal = (value: string) =>
  [...value]
    .map((character) =>
      ".^$*+?()[]{}|".includes(character) || character.charCodeAt(0) === 92
        ? String.fromCharCode(92) + character
        : character,
    )
    .join("");
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");
export const campaignOwnershipDigest = (proof: CampaignOwnershipProof) =>
  digest(JSON.stringify(proof));

function required<T>(value: T | undefined | null): T {
  if (value === undefined || value === null)
    throw new Error("Required campaign proof value is absent");
  return value;
}
function rawHtml(source: ResearchSource) {
  if (source.format !== "html" || !source.binaryBase64 || !source.byteHash)
    throw new Error("Campaign ownership requires the actual archived HTML");
  const bytes = Buffer.from(source.binaryBase64, "base64");
  if (
    bytes.length > 1_000_000 ||
    digest(bytes) !== source.byteHash ||
    formatCampaignHtml(bytes.toString("utf8"), source.url).text !== source.text
  )
    throw new Error("Campaign ownership HTML does not match its source");
  const responses = source.httpObservation?.responses;
  if (
    !responses?.length ||
    responses.at(-1)?.url !== source.url ||
    responses.at(-1)?.status !== 200 ||
    responses.at(-1)?.bodyHash !== source.byteHash ||
    responses.at(-1)?.bodyBytes !== bytes.length ||
    !/text\/html/i.test(required(responses.at(-1)).mime)
  )
    throw new Error(
      "Campaign HTML has no matching successful HTTP observation",
    );
  if (
    source.retrievalUrls &&
    JSON.stringify(source.retrievalUrls) !==
      JSON.stringify(responses.map((response) => response.url))
  )
    throw new Error(
      "Campaign HTTP observations do not bind the website redirect chain",
    );
  for (const [index, observation] of responses.entries()) {
    const url = new URL(observation.url);
    if (
      isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
      !url.hostname.includes(".") ||
      /\.(?:local|internal|localhost)$/i.test(url.hostname)
    )
      throw new Error("Campaign ownership requires a public domain");
    if (index < responses.length - 1) {
      const bytes = Buffer.from(observation.bodyBase64 ?? "", "base64");
      if (
        !observation.bodyBase64 ||
        bytes.toString("base64") !== observation.bodyBase64 ||
        bytes.length !== observation.bodyBytes ||
        bytes.length > 49_152 ||
        digest(bytes) !== observation.bodyHash
      )
        throw new Error(
          "Campaign redirect body does not replay its observed raw bytes",
        );
    }
    if (
      url.username ||
      url.password ||
      url.port ||
      !["https:", "http:"].includes(url.protocol) ||
      (index > 0 && url.protocol !== "https:") ||
      host(observation.url) !== host(source.url) ||
      Date.parse(observation.startedAt) > Date.parse(observation.completedAt) ||
      Date.parse(observation.completedAt) > Date.now()
    )
      throw new Error("Campaign HTML acquisition chain is invalid");
    if (
      index < responses.length - 1 &&
      (![301, 302, 303, 307, 308].includes(observation.status) ||
        !observation.location ||
        new URL(observation.location, observation.url).href !==
          responses[index + 1]?.url)
    )
      throw new Error("Campaign HTML redirect is not contiguous");
  }
  return bytes.toString("utf8");
}
function visibleOwnershipHtml(html: string) {
  const $ = load(html);
  $(
    'article,blockquote,q,script,style,noscript,[hidden],[aria-hidden="true"],[style*="display:none"],[style*="display: none"],[style*="visibility:hidden"],[style*="visibility: hidden"]',
  ).remove();
  return $.html();
}
export function currentGovernorContact(
  contact: ResearchSource,
  members: { name: string; party?: string | null; candidateId: string }[],
  memberId: string,
) {
  if (
    contact.url !== currentCampaignContactUrl ||
    contact.format !== "pdf" ||
    !contact.text.includes(
      "General Election - November 3, 2026\nOfficial Candidate Contact List",
    )
  )
    return undefined;
  const headings = [
    ...contact.text.matchAll(
      /^(?:Governor|Lieutenant Governor|Secretary of State|Controller|Treasurer|Attorney General|Insurance Commissioner|Superintendent of Public Instruction|Board of Equalization Member District \d+)\s*$/gm,
    ),
  ];
  const matches = headings.filter((row) => row[0].trim() === "Governor");
  if (matches.length !== 1) return undefined;
  const first = required(matches[0]);
  const end =
    headings.find((row) => row.index > first.index)?.index ??
    contact.text.length;
  const section = contact.text.slice(first.index + first[0].length, end);
  const rows = members
    .flatMap((member) =>
      [
        ...section.matchAll(
          new RegExp(
            `^${literal(member.name)}\\*? +${literal(member.party ?? "")}\\s*$`,
            "gm",
          ),
        ),
      ].map((row) => ({ member, index: row.index, length: row[0].length })),
    )
    .sort((a, b) => a.index - b.index);
  if (
    rows.length !== members.length ||
    members.some(
      (member) =>
        rows.filter((row) => row.member.candidateId === member.candidateId)
          .length !== 1,
    )
  )
    return undefined;
  const index = rows.findIndex((row) => row.member.candidateId === memberId);
  if (index < 0) return undefined;
  const selected = required(rows[index]);
  const block = section
    .slice(selected.index, rows[index + 1]?.index ?? section.length)
    .trim();
  if (/website.*(?:withheld|not (?:provided|published)|private)/i.test(block))
    return { status: "withheld" as const, excerpt: block };
  const websites = [...block.matchAll(/^WEBSITE:\s*([^\r\n]+)$/gm)];
  if (!websites.length) return { status: "missing" as const, excerpt: block };
  if (websites.length !== 1) return undefined;
  const anchor = required(required(websites[0])[1]).trim();
  const url = new URL(anchor.startsWith("www.") ? `https://${anchor}` : anchor);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  )
    return undefined;
  return { status: "listed" as const, url: url.href, anchor, excerpt: block };
}
export function qualifiedPartyWebsite(
  registry: ResearchSource,
  list: ResearchSource,
  name: string,
) {
  if (
    registry.url !== qualifiedPartyRegistryUrl ||
    list.url !== qualifiedPartyListUrl
  )
    throw new Error("Unrecognized qualified-party discovery documents");
  const registryHtml = load(visibleOwnershipHtml(rawHtml(registry)));
  const headings = registryHtml("h2")
    .toArray()
    .filter(
      (element) => registryHtml(element).text().trim() === "Democratic Party",
    );
  if (headings.length !== 1)
    throw new Error("Qualified party registry section is ambiguous");
  const anchors = registryHtml(headings[0])
    .nextUntil("h2")
    .find("a[href]")
    .toArray()
    .map((element) => registryHtml(element).attr("href"))
    .filter((url) => url === "http://www.cadem.org/");
  if (anchors.length !== 1)
    throw new Error("Official registered-party website is absent");
  const $ = load(visibleOwnershipHtml(rawHtml(list)));
  if (!$.text().includes("2026 Endorsement Process"))
    throw new Error("Party candidate list is not the selected election cycle");
  const offices = $("h4")
    .toArray()
    .filter((element) => $(element).text().trim() === "GOVERNOR");
  if (offices.length !== 1)
    throw new Error("Party Governor section is ambiguous");
  const candidates = $(offices[0])
    .nextUntil("h2,h3,h4")
    .find("a[href]")
    .toArray();
  const selected = candidates.filter(
    (element) => $(element).text().trim() === name,
  );
  if (
    selected.length !== 1 ||
    $("a[href]")
      .toArray()
      .filter((element) => $(element).text().trim() === name).length !== 1
  )
    throw new Error("Party candidate full-name row is absent or ambiguous");
  const href = required($(selected[0]).attr("href"));
  const url = new URL(href);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    !url.hostname.includes(".")
  )
    throw new Error("Invalid party-linked candidate website");
  return {
    url: url.href,
    candidateAnchor: name,
    partyWebsiteAnchor: "http://www.cadem.org/" as const,
  };
}
function campaignHtml(source: ResearchSource, sources: ResearchSource[]) {
  if (source.acquisition?.kind !== "rendered_campaign_v1")
    return rawHtml(source);
  const proof = source.acquisition;
  const stored = sources.find((row) => row.id === proof.archiveSourceId);
  if (!stored?.binaryBase64 || !stored.byteHash)
    throw new Error("Rendered campaign ownership archive is absent");
  const bytes = Buffer.from(stored.binaryBase64, "base64");
  if (digest(bytes) !== stored.byteHash)
    throw new Error("Rendered ownership archive hash mismatch");
  const { archive } = validateCampaignRenderArchive(
    campaignRenderArchiveSchema.parse(
      JSON.parse(
        gunzipSync(bytes, { maxOutputLength: 24_000_000 }).toString("utf8"),
      ),
    ),
  );
  const page = archive.pages[proof.pageIndex];
  if (
    page?.url !== source.url ||
    formatRenderedCampaignHtml(page.evidenceDomHtml, page.url).text !==
      source.text
  )
    throw new Error("Rendered ownership DOM differs from source");
  return page.evidenceDomHtml;
}
export function validateCampaignOwnership(
  dossier: Pick<
    CandidateEvidenceDossier,
    "campaignOwnershipProof" | "sources" | "identity" | "name" | "officeFamily"
  >,
) {
  const proof = dossier.campaignOwnershipProof
    ? campaignOwnershipProofSchema.parse(dossier.campaignOwnershipProof)
    : undefined;
  if (!proof) {
    if (dossier.sources.some((source) => source.acquisition))
      throw new Error("Rendered campaign has no current ownership proof");
    return;
  }
  if (
    dossier.officeFamily !== "statewide" ||
    dossier.identity.contestId !== "ca-sos:2026-11-03:020000000000" ||
    dossier.identity.electionDate !== "2026-11-03"
  )
    throw new Error(
      "Campaign ownership adapter is scoped to the current Governor race",
    );
  const roster = dossier.sources.find(
    (source) => source.url === "https://media.sos.ca.gov/media/C26GG.txt",
  );
  const rows = (roster?.text.split(/\r?\n/) ?? [])
    .filter((line) => line.startsWith("[C|CAS|"))
    .map((line) => line.slice(1, -1).split("|"))
    .filter((row) => row[3] === "020000000000");
  const selected = rows.filter(
    (row) =>
      row[4] === dossier.identity.candidateId.split(":").at(-1) &&
      row[10] === dossier.name,
  );
  if (selected.length !== 1)
    throw new Error(
      "Campaign proof candidate is absent from current official roster",
    );
  const destination = dossier.sources.find(
    (source) => source.id === proof.destinationSourceId,
  );
  if (destination?.format !== "html")
    throw new Error("Campaign destination source is absent");
  const retrieval = destination.retrievalUrls;
  if (
    !retrieval?.length ||
    retrieval[0] !== proof.listedUrl ||
    retrieval.at(-1) !== destination.url ||
    new URL(destination.url).protocol !== "https:" ||
    retrieval.some(
      (url, index) =>
        host(url) !== host(proof.listedUrl) ||
        new URL(url).username ||
        new URL(url).password ||
        new URL(url).port ||
        (index > 0 && new URL(url).protocol !== "https:"),
    )
  )
    throw new Error("Campaign destination escaped its exact website chain");
  const disclosures = formatCampaignHtml(
    visibleOwnershipHtml(campaignHtml(destination, dossier.sources)),
    destination.url,
  ).disclosures;
  const body = required(
    destination.text.split("\nLinked source navigation")[0],
  );
  if (proof.kind === "current_sos_campaign_v1") {
    const contact = dossier.sources.find(
      (source) => source.id === proof.contactSourceId,
    );
    if (!contact) throw new Error("Current campaign contact archive is absent");
    const members = rows.map((row) => ({
      candidateId: `${dossier.identity.contestId}:${row[4]}`,
      name: required(row[10]),
      party:
        row[9] === "01" ? "Democratic" : row[9] === "02" ? "Republican" : "",
    }));
    const current = currentGovernorContact(
      contact,
      members,
      dossier.identity.candidateId,
    );
    if (
      current?.status !== "listed" ||
      current.url !== proof.listedUrl ||
      current.excerpt !== proof.contactExcerpt ||
      !disclosures.some((value) =>
        new RegExp(
          `^(?:Paid for by|Authorized (?:and paid for )?by) ${literal(dossier.name)} for Governor 2026(?:\\b|$)`,
          "i",
        ).test(value),
      )
    )
      throw new Error(
        "Current candidate website lacks its exact legal publisher",
      );
  } else {
    if (required(selected[0])[9] !== "01")
      throw new Error(
        "Qualified party proof disagrees with the current candidate party",
      );
    const contact = dossier.sources.find(
      (source) => source.id === proof.currentContactSourceId,
    );
    if (!contact)
      throw new Error("Current candidate contact absence is not archived");
    const currentMembers = rows.map((row) => ({
      candidateId: `${dossier.identity.contestId}:${row[4]}`,
      name: required(row[10]),
      party:
        row[9] === "01" ? "Democratic" : row[9] === "02" ? "Republican" : "",
    }));
    const contactRow = currentGovernorContact(
      contact,
      currentMembers,
      dossier.identity.candidateId,
    );
    if (
      contactRow?.status !== "missing" ||
      contactRow.excerpt !== proof.contactExcerpt
    )
      throw new Error(
        "Party discovery cannot override withheld or unresolved official contact",
      );
    const registry = dossier.sources.find(
        (source) => source.id === proof.registrySourceId,
      ),
      list = dossier.sources.find(
        (source) => source.id === proof.partyListSourceId,
      );
    if (!registry || !list)
      throw new Error("Qualified party ownership sources are absent");
    const website = qualifiedPartyWebsite(registry, list, dossier.name);
    if (
      website.url !== proof.listedUrl ||
      website.candidateAnchor !== proof.candidateAnchor
    )
      throw new Error(
        "Party candidate website proof differs from exact source row",
      );
    const surname = required(dossier.name.split(/\s+/).at(-1));
    if (
      rows.filter(
        (row) =>
          row[9] === required(selected[0])[9] &&
          row[10]?.split(/\s+/).at(-1) === surname,
      ).length !== 1 ||
      !body.includes(dossier.name) ||
      !/governor/i.test(body) ||
      !body.includes("2026") ||
      !disclosures.includes(proof.legalOwner) ||
      !new RegExp(
        `^(?:Paid for by|Authorized (?:and paid for )?by) (?:${literal(dossier.name)}|${literal(surname)}) for Governor 2026$`,
        "i",
      ).test(proof.legalOwner)
    )
      throw new Error(
        "Party-linked campaign legal ownership is unproven or ambiguous",
      );
  }
  if (
    disclosures.some((value) =>
      /["“”]|\b(?:says?|said|quoted?|according to|not authorized|not affiliated|independent expenditure)\b/i.test(
        value,
      ),
    )
  )
    throw new Error(
      "Quoted or independent disclosure does not establish campaign ownership",
    );
}
