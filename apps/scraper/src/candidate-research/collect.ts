import { randomUUID } from "node:crypto";

import type {
  CampaignFinance,
  CandidateBrief,
  ResearchSource,
} from "@acme/validators";
import { evidenceHashKey } from "@acme/api/lib/candidate-brief-publication";
import { candidateResearchCollectionSchema } from "@acme/validators";

import { draftBrief, pilot } from "./drafts.js";
import { buildFinance } from "./finance.js";
import { profileFinance } from "./profile.js";
import { certifiedMembers, fecRows, fetchSource, field } from "./sources.js";

export type SourceFetcher = typeof fetchSource;
export async function collectPilot(
  fetcher: SourceFetcher = fetchSource,
  apiKey = process.env.FEC_API_KEY ?? "DEMO_KEY",
) {
  const sources: ResearchSource[] = [];
  const problems: string[] = [];
  const get = async (
    id: string,
    url: string,
    publisher: string,
    format: ResearchSource["format"],
    key?: string,
  ) => {
    const s = await fetcher(id, url, publisher, format, key);
    sources.push(s);
    return s;
  };
  const fec = async (
    id: string,
    path: string,
    params: Record<string, string> = {},
  ) => {
    const url = new URL(`https://api.open.fec.gov/v1/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return get(
      id,
      url.toString(),
      "Federal Election Commission",
      "json",
      apiKey,
    );
  };
  const cert = await get(
    "certified-roster",
    "https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/cert-list-candidates.pdf",
    "California Secretary of State",
    "pdf",
  );
  const media = await get(
    "roster-identifiers",
    "https://media.sos.ca.gov/media/C26GG.txt",
    "California Secretary of State",
    "text",
  );
  const members = certifiedMembers(cert, media);
  if (
    members.length !== pilot.candidates.length ||
    members.some(
      (m) =>
        !pilot.candidates.some(
          (c) => m.candidateId.endsWith(`:${c.sosId}`) && m.name === c.name,
        ),
    )
  )
    throw new Error(
      "Pilot roster changed; update identity mappings before collecting",
    );
  const contact = await get(
    "candidate-contacts",
    "https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/contact-list.pdf",
    "California Secretary of State",
    "pdf",
  );
  const contactSection = contact.text
    .split("United States Representative District 17")[1]
    ?.split("United States Representative District 18")[0];
  if (
    !contact.text.includes("November 3, 2026") ||
    !contactSection?.includes("www.tandonforcongress.com") ||
    !contactSection.includes("www.rokhanna.com")
  )
    throw new Error("Official candidate contact mapping changed");
  const powers = await get(
    "house-powers",
    "https://www.house.gov/the-house-explained/the-legislative-process",
    "US House of Representatives",
    "html",
  );
  const briefs: CandidateBrief[] = [];
  for (const candidate of pilot.candidates) {
    const profile = await get(
      `${candidate.fecId}:profile`,
      `https://www.fec.gov/data/candidate/${candidate.fecId}/?cycle=2026`,
      "Federal Election Commission",
      "html",
    );
    const profileEvidence: CandidateBrief["evidence"] = [];
    const fallbackFinance = profileFinance(profile, candidate, profileEvidence);
    let platform: ResearchSource | null = null;
    try {
      platform = await get(
        `${candidate.fecId}:platform`,
        candidate.platformUrl,
        candidate.publisher,
        "html",
      );
      if (!platform.text.includes(candidate.quote))
        throw new Error("Selected pledge not found");
    } catch {
      platform = null;
      problems.push(
        `${candidate.name}: the selected position source is unavailable or changed; review required.`,
      );
    }
    let finance: CampaignFinance | null = null;
    const financialEvidence: CandidateBrief["evidence"] = [];
    try {
      const metadata = await fec(
        `${candidate.fecId}:identity`,
        `candidate/${candidate.fecId}/`,
      );
      if (fecRows(metadata).results[0]?.name !== candidate.fecName)
        throw new Error("Official FEC identity mapping changed");
      const totals = await fec(
        `${candidate.fecId}:summary`,
        `candidate/${candidate.fecId}/totals/`,
        { cycle: "2026" },
      );
      const committees = await fec(
        `${candidate.fecId}:committees`,
        `candidate/${candidate.fecId}/committees/`,
        { cycle: "2026", per_page: "100" },
      );
      const committeePage = fecRows(committees);
      if (committeePage.pagination.count > committeePage.results.length)
        throw new Error("Committee coverage exceeds bound");
      const authorized = committeePage.results.filter(
        (r) => r.designation === "P" || r.designation === "A",
      );
      if (!authorized.length || authorized.length > 3)
        throw new Error("Authorized committee coverage exceeds bound");
      const total = fecRows(totals).results[0];
      if (!total) throw new Error("No financial summary");
      const start = field(total, "coverage_start_date").slice(0, 10),
        end = field(total, "coverage_end_date").slice(0, 10);
      const receipts: ResearchSource[] = [];
      for (const committee of authorized)
        receipts.push(
          await fec(
            `${candidate.fecId}:schedule-a:${String(committee.committee_id)}`,
            "schedules/schedule_a/",
            {
              committee_id: field(committee, "committee_id"),
              two_year_transaction_period: "2026",
              per_page: "100",
              sort: "-contribution_receipt_amount",
              min_date: start,
              max_date: end,
              min_amount: "0.01",
            },
          ),
        );
      const outside = await fec(
        `${candidate.fecId}:schedule-e`,
        "schedules/schedule_e/",
        {
          candidate_id: candidate.fecId,
          cycle: "2026",
          per_page: "100",
          is_notice: "false",
          most_recent: "true",
          min_date: start,
          max_date: end,
        },
      );
      finance = buildFinance({
        candidateId: candidate.fecId,
        metadata,
        totals,
        committees,
        receipts,
        outside,
        sources,
        evidence: financialEvidence,
      });
    } catch {
      // A verified, reconciled public summary is still publishable with explicit gaps.
      // Source-set changes create a new revision, so loss of detail cannot silently renew approval.
      finance = fallbackFinance;
      financialEvidence.splice(0, financialEvidence.length, ...profileEvidence);
    }
    briefs.push(
      draftBrief({
        candidate,
        roster: cert,
        metadata: profile,
        platform,
        powers,
        finance,
        financeGap: finance
          ? null
          : "FEC finance could not be fully collected and reconciled in this run. Open the source; no missing amounts are treated as zero.",
        evidence: finance ? financialEvidence : [],
      }),
    );
  }
  const checkedAt = new Date().toISOString();
  const currentHashes = Object.fromEntries(
    briefs.flatMap((b) =>
      b.evidence.map((e) => [evidenceHashKey(b.identity, e.id), e.contentHash]),
    ),
  );
  return candidateResearchCollectionSchema.parse({
    pilotKey: pilot.key,
    briefs,
    sources,
    problems,
    manifest: {
      id: randomUUID(),
      contestId: pilot.contestId,
      jurisdiction: pilot.jurisdiction,
      electionDate: pilot.electionDate,
      jurisdictionLabel: "California · Congressional District 17",
      office: "US House of Representatives",
      rosterSourceUrl: cert.url,
      rosterHash: cert.contentHash,
      rosterVerifiedAt: checkedAt,
      rosterVerifiedBy:
        "source-pipeline:certified-list-and-official-identifiers",
      members: members.map((m) => ({
        ...m,
        revisionId: briefs.find(
          (b) => b.identity.candidateId === m.candidateId,
        )!.revisionId,
      })),
      policyVersion: "pending",
      sourceCheckedAt: checkedAt,
      expiresAt: new Date(
        Date.parse(checkedAt) + 24 * 60 * 60 * 1000,
      ).toISOString(),
      currentHashes,
    },
  });
}
