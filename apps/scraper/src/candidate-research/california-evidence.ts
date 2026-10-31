import { load } from "cheerio";
import { extractText, getDocumentProxy } from "unpdf";

import type {
  CaliforniaRaceTarget,
  CaliforniaRosterSnapshot,
  CandidateEvidenceDossier,
  ResearchSource,
} from "@acme/validators";
import {
  officeSlug,
  officeUrl,
} from "@acme/api/lib/candidate-sources/ca-sos-voterguide";

import {
  canonicalSourceUrl,
  publicSourceAddresses,
} from "../research/pages.js";
import { requestPublicSource } from "../research/transport.js";
import { decodeClarityXmlZip } from "./california-clarity.js";
import { resolveCaliforniaOfficialCampaignWebsite } from "./california-contacts.js";
import {
  buildCaliforniaDossier,
  californiaResearchVersion,
} from "./california-dossier.js";
import { collectCaliforniaFederalFinance } from "./california-finance.js";
import { fetchSource, hash, htmlText } from "./sources.js";

export interface EvidenceBudget {
  request(): void;
  bytes(amount: number): void;
  discovery?(): void;
}
export interface CaliforniaEvidenceDependencies {
  fetch: typeof fetchSource;
  search(
    query: string,
    discover: boolean,
  ): Promise<{ sources: { url: string; title?: string }[] }>;
  budget: EvidenceBudget;
  now(): string;
  sharedSources: Map<string, Promise<ResearchSource>>;
}
const authority: Record<string, string> = {
  us_house: "https://www.house.gov/the-house-explained",
  state_senate: "https://www.senate.ca.gov/legislativeprocess",
  state_assembly: "https://www.assembly.ca.gov/legislativeprocess",
  board_of_equalization: "https://www.boe.ca.gov/info/about.htm",
  judicial_retention:
    "https://supreme.courts.ca.gov/about-court/court-and-judicial-branch",
};
const statewide: Record<string, string> = {
  Governor:
    "https://voterguide.sos.ca.gov/candidates/governor-candidate-statements.htm",
  "Lieutenant Governor": "https://ltg.ca.gov/about-the-office-of-lt-governor/",
  "Secretary of State": "https://www.sos.ca.gov/administration/about-agency",
  Controller: "https://www.sco.ca.gov/about_us.html",
  Treasurer: "https://www.treasurer.ca.gov/about.asp",
  "Attorney General": "https://oag.ca.gov/about",
  "Insurance Commissioner": "https://www.insurance.ca.gov/0500-about-us/",
  "Superintendent of Public Instruction": "https://www.cde.ca.gov/eo/",
};
const kinds = {
  us_house: "federal_legislative",
  state_senate: "state_legislative",
  state_assembly: "state_legislative",
  statewide: "state_executive",
  board_of_equalization: "state_board",
  judicial_retention: "judicial_retention",
  local: "local",
} as const;
interface OfficeAuthoritySource {
  url: string;
  marker: RegExp;
  format?: ResearchSource["format"];
  maxExcerpt?: number;
  exactMatch?: boolean;
}
interface LocalAuthorityCapability extends OfficeAuthoritySource {
  id: string;
  match: RegExp;
  officeKind?: CandidateEvidenceDossier["officeKind"];
  supporting?: OfficeAuthoritySource[];
  scopeNote?: string;
}
const localAuthorityCapabilities: LocalAuthorityCapability[] = [
  {
    id: "trial-court",
    match: /superior court|trial court/i,
    url: "https://courts.ca.gov/courts/superior-courts",
    marker: /In trial|trial.*superior.*courts/i,
    officeKind: "judicial_election",
  },
  {
    id: "community-college-board-sjeccd",
    match: /san jos[ée].*evergreen.*(?:community college|CCD)/i,
    url: "https://www.sjeccd.edu/discover-sjeccd/board-of-trustees/board-policies-administrative-procedures",
    marker: /Board policies are the voice of the Governing Board/i,
    scopeNote:
      "The district's policy overview establishes collective Board policy and Chancellor implementation roles. It does not establish every statutory power or a proposal's detailed legal steps.",
  },
  {
    id: "community-college-board-fhda",
    match: /foothill.*de.?anza.*(?:community college|CCD)/i,
    url: "https://www.fhda.edu/_chancellor/_chancellors-messages-current/_03.06.2024.html",
    marker: /Board policies are the voice of the Board of Trustees/i,
    scopeNote:
      "The district's dated policy-review explanation establishes the Board's policy and delegation roles. Other powers and proposal-specific procedures have not been independently reconciled.",
  },
  {
    id: "community-college-board-wvm",
    match: /west valley.*mission.*(?:community college|CCD)/i,
    url: "https://www.wvm.edu/board/committees/legislative-and-policy-oversight.html",
    marker: /This standing committee/i,
    supporting: [
      {
        url: "https://www.wvm.edu/committees/diversity-eeo/_documents/evidences/2018-2019/evidence-18-19-for-mm-2.pdf",
        format: "pdf",
        marker: /The Board may adopt such policies/i,
        maxExcerpt: 2000,
      },
    ],
    scopeNote:
      "The district's current committee explanation and posted Board Policy 2410 establish policy review, collective Board adoption and Chancellor implementation roles. The posted policy is dated 2015; other statutory powers have not been independently reconciled.",
  },
  {
    id: "community-college-board",
    match: /community college|communitycollege|\bCCD\b/i,
    url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=70902.&lawCode=EDC",
    marker: /70902\./,
  },
  {
    id: "county-education-board",
    match: /county.*(?:board of education|\bBOE\b)/i,
    url: "https://www.sccoe.org/supoffice/student-appeals/Pages/Interdistrict-Appeals.aspx",
    marker:
      /One of the duties and responsibilities of the Santa Clara County Board of Education/i,
    scopeNote:
      "The County Office's guidance establishes the County Board's interdistrict attendance appeal role and its limits. It does not establish all County Board powers or transfer school-district operational powers to the County Board.",
  },
  {
    id: "school-district-board",
    match: /school district|\b(?:SD|HSD)\b/i,
    url: "https://legacy.sccoe.org/docs/DBASBulletins/26-023%20%20Public%20Notification%20LCAP%20Budget-SHA%20suggestions_0.7131464.pdf",
    format: "pdf",
    marker: /The governing board of|The Budget Public Hearing/i,
    scopeNote:
      "The County Office's 2026–27 instructions establish school-board budget and LCAP hearing/adoption procedures. They do not establish every school-board power or a candidate proposal's detailed legal requirements.",
  },
  {
    id: "valley-water-board",
    match: /santa clara valley water|valley water district/i,
    url: "https://www.valleywater.org/how-we-operate/board-governance-policies",
    marker: /Board Governance Policies|Governance Process/i,
  },
  {
    id: "cupertino-sanitary-board",
    match: /cupertino sanitary district/i,
    url: "https://www.cupertinosanitarydistrict.org/board_of_directors",
    marker: /The District is governed by a Board of Directors/i,
    supporting: [
      {
        url: "https://www.cupertinosanitarydistrict.org/about_us",
        marker: /Cupertino Sanitary District/i,
      },
    ],
    scopeNote:
      "The district's pages establish its elected governing structure and wastewater service responsibilities. Specific rate-setting, contract and capital-project procedures were not established in these pages.",
  },
  {
    id: "midpen-board",
    match: /midpeninsula.*open space/i,
    url: "https://www.openspace.org/who-we-are/board",
    marker: /Midpen is governed by a seven-member board/i,
    scopeNote:
      "The official board page establishes the elected ward structure and governing body. Specific land-acquisition, budget and staff-delegation procedures have not yet been established in this source.",
  },
  {
    id: "open-space-authority",
    match: /santa clara.*open space authority/i,
    url: "https://www.openspaceauthority.org/sites/default/files/2024-12/BRD-028-09_Board%20Operating%20Rules%20and%20Procedures_Reso%202024-55_10%2024%202024.pdf",
    format: "pdf",
    marker:
      /2\.15 RESPONSIBILITIES|RESPONSIBILITIES OF THE BOARD OF DIRECTORS/i,
  },
  {
    id: "san-jose-council",
    match: /san jos[ée].*(?:council|mayor)|(?:council|mayor).*san jos[ée]/i,
    url: "https://sanjose.legistar.com/View.ashx?GUID=48306C96-6326-4EB3-8AC4-88F31D54A8AE&ID=15304311&M=F",
    format: "pdf",
    marker: /In accordance with Section 1204 of the San Jos[ée] City Charter/i,
    maxExcerpt: 950,
    supporting: [
      {
        url: "https://sanjose.legistar.com/View.ashx?G=920296E4-80BE-4CA2-A78F-32C5EFCF78AF&GUID=4B6342C5-5EB8-450A-8C19-6802C635880E&ID=1345648&M=M",
        format: "pdf",
        marker: /the Public Hearing on the FY 2026-2027 Mayor[’']s/i,
        maxExcerpt: 1700,
      },
    ],
    scopeNote:
      "The City's 2026 budget message and completed Council minutes establish budget-direction and collective approval procedures under cited Charter section 1204. Proposed spending is not treated as an adopted budget. Other charter powers have not been established in these sources.",
  },
];
export function californiaLocalAuthority(
  race: Pick<CaliforniaRaceTarget, "office" | "jurisdictionLabel">,
) {
  return (
    localAuthorityCapabilities.find((capability) =>
      capability.match.test(`${race.office} ${race.jurisdictionLabel}`),
    ) ?? null
  );
}
const compact = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
function substantiveSourceText(source: ResearchSource) {
  return source.text.split(
    "\nLinked source navigation (discovery only):\n",
  )[0]!;
}
function candidateNamePosition(text: string, name: string): number {
  const tokens = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!tokens.length) return -1;
  const pattern = tokens.join("[^\\p{L}\\p{N}]+");
  const suffix = /^(?:jr|sr|junior|senior|ii|iii|iv|v)$/i.test(
    tokens.at(-1) ?? "",
  )
    ? ""
    : "(?![\\s,]+(?:jr|sr|junior|senior|ii|iii|iv|v)(?:\\.|(?![\\p{L}\\p{N}])))";
  return text.search(
    new RegExp(
      `(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])${suffix}`,
      "iu",
    ),
  );
}
function excerpt(text: string, name: string): string | undefined {
  const position = candidateNamePosition(text, name);
  if (position < 0) return undefined;
  return text
    .slice(Math.max(0, position - 120), Math.min(text.length, position + 2800))
    .trim();
}
const publisherDisclosureMarker =
  "\nCampaign publisher disclosure (identity only):\n";
function candidatePublisherDisclosure(
  source: ResearchSource,
  name: string,
): boolean {
  const marker = source.text.lastIndexOf(publisherDisclosureMarker);
  if (marker < 0) return false;
  const disclosure = source.text.slice(
    marker + publisherDisclosureMarker.length,
  );
  if (!disclosure) return false;
  return disclosure.split("\n").some((line) => {
    const owner =
      /^(?:Paid for by|Authorized (?:and paid for )?by)\s+(.+)$/i.exec(
        line.trim(),
      );
    return (
      !!owner &&
      candidateNamePosition(owner[1]!, name) === 0 &&
      !/["“”]|\b(?:says?|said|quoted?|according to|not authorized|not affiliated|independent expenditure)\b/i.test(
        line,
      )
    );
  });
}
export function qualifiedCandidatePage(
  source: ResearchSource,
  race: CaliforniaRaceTarget,
  name: string,
  crossLinked: boolean,
): boolean {
  const substantive = substantiveSourceText(source);
  if (candidateNamePosition(substantive, name) < 0) return false;
  if (crossLinked) return true;
  const body = compact(substantive);
  if (
    race.kind === "retention" &&
    /(^|\.)[a-z0-9-]+\.gov$/i.test(new URL(source.url).hostname) &&
    body.includes("california")
  ) {
    if (race.sourceContestId.startsWith("14"))
      return body.includes("supreme court");
    const district = Number(race.sourceContestId.slice(6, 8));
    const division = Number(race.sourceContestId.slice(8, 10));
    const ordinals = [
      "",
      "first",
      "second",
      "third",
      "fourth",
      "fifth",
      "sixth",
      "seventh",
      "eighth",
    ];
    const numbers = [
      "",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
    ];
    const districtMatches = [
      `${ordinals[district]} appellate district`,
      `${ordinals[district]} district`,
      `district ${district}`,
    ].some((value) => body.includes(value));
    const divisionMatches =
      division === 0 ||
      [
        `division ${division}`,
        `division ${numbers[division]}`,
        `division ${ordinals[division]}`,
      ].some((value) => body.includes(value));
    return (
      body.includes("court of appeal") && districtMatches && divisionMatches
    );
  }
  const office = compact(race.office.replace(/District\s+\d+/i, ""));
  return (
    body.includes(office) &&
    body.includes("california") &&
    body.includes("2026") &&
    (!race.district ||
      new RegExp(`(?:district|district no) ${race.district}(?: |$)`).test(body))
  );
}
export async function collectCaliforniaEvidence(
  input: {
    snapshot: CaliforniaRosterSnapshot;
    race: CaliforniaRaceTarget;
    member: CaliforniaRaceTarget["members"][number];
    previousDossier?: CandidateEvidenceDossier;
    supplementalSources?: ResearchSource[];
  },
  deps: CaliforniaEvidenceDependencies,
): Promise<CandidateEvidenceDossier> {
  const { snapshot, race, member } = input;
  const rosterSource: ResearchSource =
    race.officeFamily === "local"
      ? (() => {
          const proof = member.sourceProof ?? race.sourceProof;
          const archived = snapshot.additionalSources?.find(
            (source) =>
              source.url === proof?.url &&
              source.contentHash === proof.contentHash,
          );
          if (!archived)
            throw new Error(
              "Local membership lacks its archived authoritative roster source",
            );
          return {
            ...archived,
            id: `official-roster-${hash(archived.url).slice(0, 24)}`,
          };
        })()
      : {
          id: "official-roster",
          url: snapshot.source.url,
          publisher: "California Secretary of State",
          format: "text",
          text: snapshot.source.text,
          contentHash: snapshot.source.textHash,
          fetchedAt: snapshot.source.fetchedAt,
        };
  const sources: ResearchSource[] = [rosterSource];
  const rosterQuote =
    race.officeFamily === "local"
      ? member.sourceProof &&
        rosterSource.text.includes(member.sourceProof.excerpt)
        ? member.sourceProof.excerpt
        : rosterSource.text.includes(member.name)
          ? member.name
          : undefined
      : rosterSource.text
          .split(/\r?\n/)
          .find(
            (line) =>
              line.includes(`|${member.sourceCandidateId}|`) &&
              line.includes(`|${race.sourceContestId}|`),
          );
  if (!rosterQuote)
    throw new Error("Candidate membership is absent from immutable roster");
  const evidence: CandidateEvidenceDossier["evidence"] = [
    {
      id: "roster",
      sourceId: rosterSource.id,
      excerpt: rosterQuote,
      locator:
        member.sourceProof?.locator ??
        `SOS contest ${race.sourceContestId}; candidate ${member.sourceCandidateId}`,
      origin: "primary_record",
      role: "roster",
      identityQualification: "official_roster",
    },
  ];
  const gaps: CandidateEvidenceDossier["gaps"] = [];
  for (const source of input.supplementalSources ?? [])
    if (!sources.some((existing) => existing.id === source.id))
      sources.push(source);
  const get = async (
    url: string,
    publisher: string,
    format: ResearchSource["format"] = "html",
    preferredId?: string,
  ) => {
    const checked = sources.find((source) => source.url === url);
    if (checked) return checked;
    let pending = deps.sharedSources.get(url);
    if (!pending) {
      deps.budget.request();
      pending = deps
        .fetch(
          preferredId ?? `source-${hash(url).slice(0, 24)}`,
          url,
          publisher,
          format,
          new URL(url).hostname === "api.open.fec.gov"
            ? (process.env.FEC_API_KEY ?? "DEMO_KEY")
            : undefined,
        )
        .then((source) => {
          deps.budget.bytes(Buffer.byteLength(source.text));
          return source;
        });
      deps.sharedSources.set(url, pending);
    }
    const source = await pending;
    const priorIndex = sources.findIndex(
      (existing) => existing.id === source.id,
    );
    if (priorIndex < 0) sources.push(source);
    else {
      const existing = sources[priorIndex]!;
      if (
        existing.url !== source.url ||
        existing.contentHash !== source.contentHash
      )
        throw new CaliforniaCitedSourceFailure(
          "A source identity changed during the bounded retrieval",
        );
      sources[priorIndex] = source;
    }
    return source;
  };
  const priorCitedSources = (input.previousDossier?.sources ?? []).filter(
    (source) =>
      input.previousDossier!.evidence.some(
        (entry) => entry.sourceId === source.id,
      ),
  );
  // Derived finance row archives are reconstructed by the typed adapter from
  // freshly retrieved parent documents, never substituted with a raw URL body.
  const derivedFinanceSource = (source: ResearchSource) =>
    (input.previousDossier?.sources ?? []).some(
      (other) => other.id !== source.id && other.url === source.url,
    ) && /^[A-Z][A-Z0-9]{8}:/.test(source.id);
  for (const priorSource of priorCitedSources.filter(
    (source) => !derivedFinanceSource(source),
  )) {
    try {
      const fresh = await get(
        priorSource.url,
        priorSource.publisher,
        priorSource.format,
        priorSource.id,
      );
      if (fresh.contentHash !== priorSource.contentHash)
        throw new CaliforniaCitedSourceFailure(
          `A previously cited source changed: ${priorSource.url}`,
        );
    } catch (error) {
      if (
        error instanceof CaliforniaBudgetReached ||
        error instanceof CaliforniaCitedSourceFailure
      )
        throw error;
      throw new CaliforniaCitedSourceFailure(
        `A previously cited source could not be refreshed: ${priorSource.url}`,
      );
    }
  }
  const localCapability =
    race.officeFamily === "local" ? californiaLocalAuthority(race) : null;
  let authorityUrl = localCapability?.url ?? authority[race.officeFamily];
  if (race.officeFamily === "statewide") authorityUrl = statewide[race.office];
  if (
    race.officeFamily === "judicial_retention" &&
    race.sourceContestId.startsWith("15")
  )
    authorityUrl = "https://appellate.courts.ca.gov/about-courts";
  if (authorityUrl) {
    try {
      const requiredAuthoritySources: OfficeAuthoritySource[] = localCapability
        ? [localCapability, ...(localCapability.supporting ?? [])]
        : race.officeFamily === "statewide" &&
            race.office === "Lieutenant Governor"
          ? [
              {
                url: authorityUrl,
                marker:
                  /Under California[’']s Constitution, the Lieutenant Governor serves as Acting Governor/,
              },
            ]
          : race.officeFamily === "statewide" && race.office === "Governor"
            ? [
                {
                  url: authorityUrl,
                  marker:
                    /As the state[’']s chief executive officer, oversees most state departments and agencies, and appoints judges\. Proposes new laws, approves or vetoes legislation, and submits the annual state budget to the Legislature\. Mobilizes and directs state resources during emergencies\./,
                  exactMatch: true,
                },
              ]
            : [{ url: authorityUrl, marker: /.*/ }];
      const checkedAuthoritySourceIds: string[] = [];
      for (const [index, descriptor] of requiredAuthoritySources.entries()) {
        const source = await get(
          descriptor.url,
          "Official office responsibilities",
          descriptor.format ?? "html",
        );
        const body = substantiveSourceText(source);
        const match = descriptor.marker.exec(body);
        if (!match)
          throw new Error(
            "Official authority source does not contain the required office provision",
          );
        const start = Math.max(0, match.index - 120);
        evidence.push({
          id:
            index === 0 ? "office-authority" : `office-authority-${index + 1}`,
          sourceId: source.id,
          excerpt: descriptor.exactMatch
            ? match[0]
            : body.slice(start, start + (descriptor.maxExcerpt ?? 3800)),
          locator: localCapability
            ? `Official office authority: ${localCapability.id}`
            : "Official responsibilities and institutional constraints",
          origin: "primary_record",
          role: "office_authority",
          identityQualification: "exact_election_office",
        });
        checkedAuthoritySourceIds.push(source.id);
      }
      if (localCapability?.scopeNote)
        gaps.push({
          dimension: "mechanisms",
          code: "not_found_in_checked_sources",
          message: localCapability.scopeNote,
          checkedSourceIds: checkedAuthoritySourceIds,
          required: false,
        });
    } catch (error) {
      if (
        error instanceof CaliforniaBudgetReached ||
        error instanceof CaliforniaCitedSourceFailure
      )
        throw error;
      gaps.push({
        dimension: "mechanisms",
        code: "source_unavailable",
        message:
          "The official office-authority source could not be retrieved in this attempt.",
        checkedSourceIds: [],
        required: true,
      });
    }
  } else
    gaps.push({
      dimension: "mechanisms",
      code: "identity_unresolved",
      message: "No verified office-authority adapter exists for this office.",
      checkedSourceIds: [],
      required: true,
    });
  let campaignContactProof: CandidateEvidenceDossier["campaignContactProof"];
  let localWebsite:
    | ReturnType<typeof resolveCaliforniaOfficialCampaignWebsite>
    | undefined;
  if (race.officeFamily === "local") {
    try {
      localWebsite = resolveCaliforniaOfficialCampaignWebsite({
        snapshot,
        race,
        member,
      });
      if (localWebsite.status !== "listed")
        gaps.push({
          dimension: "priorities",
          code:
            localWebsite.status === "identity_unresolved"
              ? "identity_unresolved"
              : "not_found_in_checked_sources",
          message:
            localWebsite.status === "missing"
              ? "The archived official candidate filing did not list a campaign website."
              : "We could not verify a campaign website from the archived official filing.",
          checkedSourceIds: [],
          required: false,
        });
    } catch {
      gaps.push({
        dimension: "priorities",
        code: "identity_unresolved",
        message:
          "We could not verify a campaign website from the archived official filing.",
        checkedSourceIds: [],
        required: false,
      });
    }
  }
  let contact: ResearchSource | undefined;
  if (race.officeFamily !== "local")
    try {
      contact = await get(
        "https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/contact-list.pdf",
        "California Secretary of State",
        "pdf",
      );
    } catch (error) {
      if (
        error instanceof CaliforniaBudgetReached ||
        error instanceof CaliforniaCitedSourceFailure
      )
        throw error;
      gaps.push({
        dimension: "priorities",
        code: "source_unavailable",
        message:
          "Official campaign contacts could not be retrieved in this attempt.",
        checkedSourceIds: [],
        required: false,
      });
    }
  let contactExcerpt: string | undefined;
  if (contact) {
    const start = contact.text.indexOf(member.name);
    if (
      start >= 0 &&
      snapshot.races
        .flatMap((target) => target.members)
        .filter((other) => compact(other.name) === compact(member.name))
        .length === 1
    ) {
      let end = Math.min(contact.text.length, start + 1500);
      for (const other of snapshot.races.flatMap((target) => target.members))
        if (other.candidateId !== member.candidateId) {
          const next = contact.text.indexOf(
            other.name,
            start + member.name.length,
          );
          if (next >= 0) end = Math.min(end, next);
        }
      contactExcerpt = contact.text.slice(start, end);
    }
  }
  const linked =
    localWebsite?.status === "listed" && localWebsite.url
      ? [localWebsite.url]
      : (contactExcerpt?.match(/(?:https?:\/\/|www\.)[^\s<>]+/g) ?? []).map(
          (url) =>
            (url.startsWith("www.") ? `https://${url}` : url).replace(
              /[.,;)]+$/,
              "",
            ),
        );
  const query = member.name;
  const statementSlug = officeSlug(race.office);
  const officialStatements = statementSlug
    ? [officeUrl(statementSlug)]
    : race.kind === "retention"
      ? [
          race.sourceContestId.startsWith("14")
            ? "https://voterguide.sos.ca.gov/justices/supreme-court.htm"
            : "https://voterguide.sos.ca.gov/justices/court-of-appeal.htm",
        ]
      : [];
  const withoutInitials = (value: string) =>
    compact(value)
      .split(" ")
      .filter((word) => word.length > 1)
      .join(" ");
  const courtLinks = sources
    .flatMap((source) =>
      source.text
        .split("\n")
        .filter((line) =>
          withoutInitials(line.split(" => ")[0] ?? "").includes(
            withoutInitials(member.name),
          ),
        )
        .flatMap((line) => line.match(/https?:\/\/[^\s]+/g) ?? []),
    )
    .filter((url) => new URL(url).hostname.endsWith("courts.ca.gov"));
  const linkedBiographies = [...new Set(courtLinks)];
  if (linkedBiographies.length > 1) linkedBiographies.splice(0);
  const discoveries: string[] = [...linkedBiographies, ...officialStatements];
  try {
    for (const discover of [false, true]) {
      deps.budget.request();
      deps.budget.discovery?.();
      const result = await deps.search(query, discover);
      discoveries.push(...result.sources.map((s) => s.url));
      if (discoveries.length >= 4 || linked.length) break;
    }
  } catch (error) {
    if (
      error instanceof CaliforniaBudgetReached ||
      error instanceof CaliforniaCitedSourceFailure
    )
      throw error;
    gaps.push({
      dimension: "record",
      code: "source_unavailable",
      message: "Candidate-source discovery was unavailable in this attempt.",
      checkedSourceIds: [],
      required: false,
    });
  }
  let unavailable = false;
  const sourceLinks: NonNullable<CandidateEvidenceDossier["sourceLinks"]> = [];
  const queue: { url: string; parent?: ResearchSource; anchorText?: string }[] =
    [...new Set([...linked, ...discoveries])].map((url) => ({ url }));
  const visited = new Set<string>();
  let candidatePages = 0;
  for (let index = 0; index < queue.length && candidatePages < 5; index++) {
    const { url, parent, anchorText } = queue[index]!;
    if (visited.has(url)) continue;
    visited.add(url);
    candidatePages++;
    try {
      if (!/^https?:\/\//.test(url)) continue;
      const source = await get(
        url,
        new URL(url).hostname,
        /\.pdf(?:$|\?)/i.test(url) ? "pdf" : "html",
      );
      if (parent) {
        if (new URL(parent.url).origin !== new URL(source.url).origin) continue;
        sourceLinks.push({
          fromSourceId: parent.id,
          toSourceId: source.id,
          url: source.url,
          anchorText: anchorText!,
          relation: "same_origin_campaign",
        });
      } else if (
        !qualifiedCandidatePage(source, race, member.name, linked.includes(url))
      )
        continue;
      if (linked.includes(url)) {
        if (!candidatePublisherDisclosure(source, member.name)) continue;
        if (localWebsite?.status === "listed") {
          if (
            !localWebsite.url ||
            !localWebsite.officialSource ||
            !source.retrievalUrls
          )
            continue;
          campaignContactProof = {
            kind: "historical_official_filing",
            identity: localWebsite.requestedCandidateIdentity,
            websiteUrl: localWebsite.url,
            destinationSourceId: source.id,
            officialSource: localWebsite.officialSource,
            retrievalUrls: source.retrievalUrls,
          };
        }
        const rawAnchor = (
          contactExcerpt?.match(/(?:https?:\/\/|www\.)[^\s<>]+/g) ?? []
        ).find(
          (value) =>
            (value.startsWith("www.") ? `https://${value}` : value).replace(
              /[.,;)]+$/,
              "",
            ) === url,
        );
        if (rawAnchor && contact)
          sourceLinks.push({
            fromSourceId: contact.id,
            toSourceId: source.id,
            url: source.url,
            anchorText: rawAnchor,
            relation: "official_contact",
          });
        const children = source.text
          .split("\n")
          .flatMap((line) => {
            const divider = line.indexOf(" => ");
            if (divider < 0) return [];
            const label = line.slice(0, divider);
            const childURL = line.slice(divider + 4);
            try {
              const parsed = new URL(childURL);
              return new URL(source.url).origin === parsed.origin &&
                /issues|priorit|platform|plans|about/i.test(
                  `${label} ${parsed.pathname}`,
                ) &&
                !/donat|contribut|endorse|volunteer|shop/i.test(
                  `${label} ${parsed.pathname}`,
                ) &&
                !visited.has(childURL)
                ? [{ url: childURL, parent: source, anchorText: label }]
                : [];
            } catch {
              return [];
            }
          })
          .slice(0, 2);
        queue.splice(index + 1, 0, ...children);
      }
      const substantive = substantiveSourceText(source);
      const ownNameStart = candidateNamePosition(substantive, member.name);
      if (ownNameStart < 0 && !parent) continue;
      const start = Math.max(0, ownNameStart);
      let quote =
        parent && ownNameStart < 0
          ? substantive.slice(0, 2800)
          : excerpt(substantive, member.name);
      if (!quote) continue;
      let end = Math.min(substantive.length, start + 2800);
      for (const other of officialStatements.includes(url) ? race.members : [])
        if (other.candidateId !== member.candidateId) {
          const next = substantive
            .toLocaleLowerCase()
            .indexOf(
              other.name.toLocaleLowerCase(),
              start + member.name.length,
            );
          if (next >= 0) end = Math.min(end, next);
        }
      quote = substantive.slice(start, end).trim();
      const official = /(^|\.)[a-z0-9-]+\.gov$/i.test(
        new URL(source.url).hostname,
      );
      if (
        quote.length < 180 ||
        !/\b(will|support|oppose|worked|served|appointed|confirmed|authored|plan|priorit|protect|reduce|expand|reform|achiev|lead|led)\w*\b/i.test(
          quote,
        )
      )
        continue;
      const officialStatement =
        officialStatements.includes(url) &&
        race.kind !== "retention" &&
        new URL(source.url).origin === new URL(url).origin;
      const candidateSupplied =
        linked.includes(url) || !!parent || officialStatement;
      if (!candidateSupplied && !official) continue;
      const campaignMaterial = candidateSupplied && !officialStatement;
      if (campaignMaterial && substantive.length > 12_000) {
        gaps.push({
          dimension: "record",
          code: "source_unavailable",
          message:
            "A campaign page exceeded the bounded context limit. Its attribution context was not clipped or inferred.",
          checkedSourceIds: [source.id],
          required: false,
        });
        continue;
      }
      evidence.push({
        id: `candidate-${evidence.length}`,
        sourceId: source.id,
        excerpt: quote,
        locator: `Candidate-specific passage for ${member.name}`,
        origin: candidateSupplied ? "candidate" : "primary_record",
        role: campaignMaterial
          ? "campaign_material"
          : officialStatement
            ? "candidate_statement"
            : "candidate_record",
        ...(candidateSupplied
          ? {
              attribution: {
                status: campaignMaterial
                  ? ("unresolved" as const)
                  : ("official_candidate_statement" as const),
                context: {
                  excerpt: campaignMaterial ? substantive : quote,
                  locator: campaignMaterial
                    ? "Complete bounded substantive campaign page; publisher identity does not establish the speaker."
                    : "Official candidate-submitted statement channel.",
                },
              },
            }
          : {}),
        identityQualification:
          linked.includes(url) || !!parent
            ? "official_cross_link"
            : "exact_election_office",
      });
    } catch (error) {
      if (
        error instanceof CaliforniaBudgetReached ||
        error instanceof CaliforniaCitedSourceFailure
      )
        throw error;
      unavailable = true;
    }
  }
  if (
    !evidence.some(
      (entry) =>
        entry.role === "campaign_material" ||
        entry.role === "candidate_statement" ||
        entry.role === "candidate_record",
    )
  )
    gaps.push({
      dimension: "priorities",
      code: unavailable ? "source_unavailable" : "not_found_in_checked_sources",
      message: unavailable
        ? "Candidate-specific source retrieval failed; this is not evidence that no platform exists."
        : "No identity-qualified candidate-specific platform or record was found in the bounded sources checked.",
      checkedSourceIds: sources
        .filter(
          (source) => !/(^|\.)fec\.gov$/i.test(new URL(source.url).hostname),
        )
        .map((source) => source.id)
        .sort(),
      required: false,
    });
  let finance: CandidateEvidenceDossier["finance"] = null;
  let financeIdentityProof: Awaited<
    ReturnType<typeof collectCaliforniaFederalFinance>
  >["identityProof"];
  let financeGapCode: CandidateEvidenceDossier["gaps"][number]["code"] =
    "not_found_in_checked_sources";
  let financeGap =
    "California or local campaign-finance totals and donor records have not been reconciled. Federal FEC records do not apply to this office.";
  if (race.officeFamily === "us_house") {
    const result = await collectCaliforniaFederalFinance(
      { race, member },
      {
        fetch: deps.fetch,
        sharedSources: deps.sharedSources,
        budget: deps.budget,
        apiKey: process.env.FEC_API_KEY,
      },
    );
    finance = result.finance;
    financeIdentityProof = result.identityProof;
    financeGap = result.gap ?? "";
    financeGapCode = result.gapCode ?? "not_found_in_checked_sources";
    for (const source of result.sources)
      if (!sources.some((existing) => existing.id === source.id))
        sources.push(source);
    for (const citation of result.evidence) {
      const source = result.sources.find(
        (entry) =>
          entry.url === citation.url &&
          entry.contentHash === citation.contentHash &&
          entry.text.includes(citation.excerpt),
      );
      if (!source)
        throw new Error(
          "FEC evidence does not quote its archived finance source",
        );
      evidence.push({
        id: citation.id,
        sourceId: source.id,
        excerpt: citation.excerpt,
        locator: citation.locator,
        origin: "primary_record",
        role: "finance",
        identityQualification: "exact_election_office",
      });
    }
  }
  if (financeGap)
    gaps.push({
      dimension: "finance",
      code: financeGapCode,
      message: financeGap,
      checkedSourceIds: sources
        .filter((source) => new URL(source.url).hostname.endsWith("fec.gov"))
        .map((source) => source.id),
      required: false,
    });
  if (race.kind === "retention")
    gaps.push({
      dimension: "priorities",
      code: "not_applicable",
      message:
        "Judicial retention evaluates continued judicial service. Policy promises and legislative platforms are not expected.",
      checkedSourceIds: [rosterSource.id],
      required: false,
    });
  for (const prior of priorCitedSources.filter(derivedFinanceSource)) {
    const fresh = sources.find(
      (source) => source.id === prior.id && source.url === prior.url,
    );
    if (!fresh || fresh.contentHash !== prior.contentHash)
      throw new CaliforniaCitedSourceFailure(
        `A previously cited finance row changed or could not be reconstructed: ${prior.url}`,
      );
  }
  return buildCaliforniaDossier({
    identity: member.identity,
    name: member.name,
    officeFamily: race.officeFamily,
    officeKind: localCapability?.officeKind ?? kinds[race.officeFamily],
    rosterDigest: race.rosterDigest,
    researchVersion: californiaResearchVersion,
    createdAt: deps.now(),
    sources,
    evidence,
    finance,
    financeIdentityProof,
    sourceLinks,
    campaignContactProof,
    gaps,
  });
}
export class CaliforniaCitedSourceFailure extends Error {}
export class CaliforniaBudgetReached extends Error {
  constructor(public dimension: string) {
    super(`California research budget reached for ${dimension}`);
  }
}

export async function fetchBoundedCaliforniaSource(
  id: string,
  url: string,
  publisher: string,
  format: ResearchSource["format"],
  budget: EvidenceBudget,
  apiKey?: string,
  controls?: {
    transport?: typeof requestPublicSource;
    addresses?: typeof publicSourceAddresses;
  },
): Promise<ResearchSource> {
  let currentURL = canonicalSourceUrl(url);
  const transport = controls?.transport ?? requestPublicSource;
  const addresses = controls?.addresses ?? publicSourceAddresses;
  const signal = AbortSignal.timeout(30_000);
  let response: Response | undefined;
  const retrievalUrls: string[] = [];
  for (let redirects = 0; redirects <= 3; redirects++) {
    const resolved = await addresses(currentURL);
    retrievalUrls.push(currentURL);
    response = await transport(currentURL, resolved, signal, {
      "User-Agent": "Mozilla/5.0 (compatible; BillionResearch/1.0)",
      Accept: "text/html,application/pdf,text/plain,application/json",
      ...(apiKey &&
      new URL(currentURL).hostname === "api.open.fec.gov" &&
      new URL(currentURL).origin === new URL(url).origin
        ? { "X-Api-Key": apiKey }
        : {}),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    await response.body?.cancel();
    const location = response.headers.get("location");
    if (!location) throw new Error("Source redirect has no location");
    if (redirects === 3) throw new Error("Source exceeds three redirects");
    currentURL = canonicalSourceUrl(new URL(location, currentURL).toString());
    if (new URL(currentURL).hostname === "validate.perfdrive.com")
      throw new Error("Source requires an interactive access check");
    budget.request();
  }
  if (!response?.ok) {
    await response?.body?.cancel();
    throw new Error(
      `Source request failed (${response?.status ?? "no response"})`,
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Source has no body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > (format === "image" ? 5_000_000 : 25_000_000))
        throw new Error("Source exceeds per-document byte bound");
      budget.bytes(part.value.byteLength);
      chunks.push(part.value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  }
  const buffer = Buffer.concat(chunks);
  let text: string;
  if (format === "image") {
    if (buffer.byteLength > 5_000_000)
      throw new Error("Image source exceeds byte bound");
    text = "";
  } else if (format === "pdf") {
    const document = await getDocumentProxy(new Uint8Array(buffer));
    try {
      if (document.numPages > 300)
        throw new Error("Source exceeds 300-page bound");
      const result = await extractText(document, { mergePages: false });
      text = result.text
        .map((page, index) => `[Page ${index + 1}]\n${page}`)
        .join("\n");
    } finally {
      await document.destroy();
    }
  } else if (format === "html") {
    const html = buffer.toString("utf8");
    const $ = load(html);
    const links: string[] = [];
    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
      const label = $(element).text().replace(/\s+/g, " ").trim();
      if (!href || !label || links.length >= 200) return;
      try {
        const target = new URL(href, currentURL);
        if (/^https?:$/.test(target.protocol))
          links.push(`${label} => ${target.toString()}`);
      } catch {}
    });
    const substantive = htmlText(html);
    $("blockquote,q,script,style,noscript").remove();
    const disclosures = $(
      "footer,[role=contentinfo],[class*=disclaimer],[id*=disclaimer]",
    )
      .toArray()
      .filter((element) => !$(element).parents("article").length)
      .flatMap((element) => {
        const value = $(element).text().replace(/\s+/g, " ").trim();
        const offset =
          /\b(?:Paid for by|Authorized (?:and paid for )?by)\b/i.exec(
            value,
          )?.index;
        if (
          offset === undefined ||
          /["“”'‘’]|\b(?:says?|said|reports?|quoted?|according to)\b/i.test(
            value.slice(0, offset),
          )
        )
          return [];
        return [value.slice(offset)];
      });
    text =
      substantive +
      "\nLinked source navigation (discovery only):\n" +
      links.join("\n") +
      publisherDisclosureMarker +
      [...new Set(disclosures)].join("\n");
  } else if (format === "json")
    text = JSON.stringify(JSON.parse(buffer.toString("utf8")), null, 2);
  else if (format === "text" && /\.zip$/.test(currentURL))
    text = decodeClarityXmlZip(new Uint8Array(buffer), currentURL);
  else
    text = new TextDecoder(
      currentURL === "https://media.sos.ca.gov/media/C26GG.txt"
        ? "windows-1252"
        : "utf-8",
      { fatal: true },
    ).decode(buffer);
  const clarityVersion =
    currentURL ===
      "https://results.enr.clarityelections.com/CA/Santa_Clara/127570/current_ver.txt" &&
    /^\d{6}$/.test(text.trim());
  if (
    (!clarityVersion && format !== "image" && text.length < 20) ||
    text.length > 5_000_000
  )
    throw new Error("Unusable source text");
  return {
    id,
    url: currentURL,
    retrievalUrls,
    publisher,
    format,
    text,
    contentHash: hash(text),
    byteHash: hash(buffer),
    ...(format === "image" ? { binaryBase64: buffer.toString("base64") } : {}),
    fetchedAt: new Date().toISOString(),
  };
}
