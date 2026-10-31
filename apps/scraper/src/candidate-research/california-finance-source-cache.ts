import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import type {
  CandidateEvidenceDossier,
  ResearchSource,
} from "@acme/validators";

import { validateCaliforniaDossier } from "./california-dossier.js";
import { exactFecRows } from "./fec-finance-components.js";

const maximumAge = 12 * 60 * 60 * 1000;
const queryPaths = new Set([
  "/v1/reports/house-senate/",
  "/v1/schedules/schedule_e/by_candidate/",
  "/v1/filings/",
]);
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

export function reusableFinanceQuerySources(input: {
  digest: string;
  document: unknown;
  expected: CandidateEvidenceDossier;
  now: string;
}): ResearchSource[] {
  try {
    const dossier = validateCaliforniaDossier(input.document);
    const now = Date.parse(input.now);
    if (
      !Number.isFinite(now) ||
      dossier.dossierDigest !== input.digest ||
      dossier.officeKind !== "federal_legislative" ||
      !isDeepStrictEqual(dossier.identity, input.expected.identity) ||
      dossier.name !== input.expected.name ||
      dossier.officeFamily !== input.expected.officeFamily ||
      dossier.officeKind !== input.expected.officeKind ||
      dossier.rosterDigest !== input.expected.rosterDigest ||
      dossier.researchVersion !== input.expected.researchVersion
    )
      return [];
    return dossier.sources.filter((source) => {
      try {
        const url = new URL(source.url);
        const observed = Date.parse(source.fetchedAt);
        const candidateQuery =
          url.pathname === "/v1/schedules/schedule_e/by_candidate/";
        const filter = candidateQuery ? "candidate_id" : "committee_id";
        const ids = url.searchParams.getAll(filter);
        const parameters = new Set([
          "cycle",
          "per_page",
          "page",
          filter,
          ...(!candidateQuery ? ["most_recent"] : []),
        ]);
        if (
          source.id !== `fec-${hash(source.url).slice(0, 20)}` ||
          source.format !== "json" ||
          source.publisher !== "Federal Election Commission" ||
          source.binaryBase64 ||
          dossier.evidence.some(
            (entry) => entry.sourceId === source.id && entry.role !== "finance",
          ) ||
          dossier.gaps.some(
            (gap) =>
              gap.dimension !== "finance" &&
              gap.checkedSourceIds.includes(source.id),
          ) ||
          dossier.sourceLinks?.some(
            (link) =>
              link.fromSourceId === source.id || link.toSourceId === source.id,
          ) ||
          dossier.campaignContactProof?.destinationSourceId === source.id ||
          dossier.campaignContactProof?.officialSource.url === source.url ||
          source.contentHash !== hash(source.text) ||
          url.origin !== "https://api.open.fec.gov" ||
          url.username ||
          url.password ||
          url.hash ||
          url.toString() !== source.url ||
          !queryPaths.has(url.pathname) ||
          url.searchParams.get("cycle") !==
            input.expected.identity.electionDate.slice(0, 4) ||
          url.searchParams.get("page") !== "1" ||
          url.searchParams.get("per_page") !== "100" ||
          (!candidateQuery && url.searchParams.get("most_recent") !== "true") ||
          !ids.length ||
          ids.length > 100 ||
          ids.some(
            (id) => !(candidateQuery ? /^H[A-Z0-9]{8}$/ : /^C\d{8}$/).test(id),
          ) ||
          [...url.searchParams.keys()].some((name) => !parameters.has(name)) ||
          !Number.isFinite(observed) ||
          observed > now ||
          now - observed >= maximumAge
        )
          return false;
        exactFecRows(source);
        return true;
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

export function seedFinanceQueryCache(
  sources: ResearchSource[],
  sharedSources: Map<string, Promise<ResearchSource>>,
): void {
  for (const source of sources)
    if (!sharedSources.has(source.url))
      sharedSources.set(source.url, Promise.resolve(source));
}
