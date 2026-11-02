import { isDeepStrictEqual } from "node:util";

import type {
  CandidateEvidenceDossier,
  ResearchSource,
} from "@acme/validators";

import { reusableFinanceQuerySources } from "./california-finance-source-cache.js";
import { CaliforniaSourceUnavailable } from "./california-source-availability.js";
import { hash } from "./sources.js";

const maximumAge = 12 * 60 * 60 * 1000;
function diagnosticUrl(value: string): string {
  if (!URL.canParse(value)) return "unavailable-source";
  const url = new URL(value);
  return ["https:", "http:"].includes(url.protocol)
    ? `${url.origin}${url.pathname}`
    : "unavailable-source";
}
export function isFecApiUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const host = new URL(value).hostname.toLowerCase().replace(/\.+$/, "");
  return ["api.open.fec.gov", "api.data.gov"].some(
    (api) => host === api || host.endsWith(`.${api}`),
  );
}
export class CaliforniaFinanceCacheUnavailable extends CaliforniaSourceUnavailable {
  constructor(url: string, reason: string) {
    super(diagnosticUrl(url), new Error(reason));
    this.name = "CaliforniaFinanceCacheUnavailable";
    this.message = `Finance cache-only acquisition unavailable: ${reason}`;
  }
}
export class CaliforniaFinanceCacheOnly {
  private readonly sources = new Map<
    string,
    { source: ResearchSource; owners: Set<string> }
  >();
  private readonly hits: {
    candidateId: string;
    sourceId: string;
    url: string;
    contentHash: string;
    fetchedAt: string;
    lookupAt: string;
    cacheOwners: string[];
  }[] = [];
  private readonly misses: { url: string; reason: string }[] = [];
  private readonly denials: { url: string; stage: string }[] = [];
  private readonly completeMembers = new Set<string>();
  private transports = 0;

  constructor(private readonly now: () => string) {}

  seed(input: {
    digest: string;
    document: unknown;
    expected: CandidateEvidenceDossier;
  }) {
    for (const source of reusableFinanceQuerySources({
      ...input,
      now: this.now(),
    })) {
      const existing = this.sources.get(source.url);
      if (existing && !isDeepStrictEqual(existing.source, source))
        throw new CaliforniaFinanceCacheUnavailable(
          source.url,
          "Conflicting raw query observations",
        );
      if (existing) existing.owners.add(input.expected.identity.candidateId);
      else
        this.sources.set(source.url, {
          source: structuredClone(source),
          owners: new Set([input.expected.identity.candidateId]),
        });
    }
  }

  read(url: string, candidateId: string): ResearchSource {
    const cached = this.sources.get(url);
    const lookupAt = this.now();
    const observed = Date.parse(cached?.source.fetchedAt ?? "");
    const current = Date.parse(lookupAt);
    let reason: string | undefined;
    if (!isFecApiUrl(url) || !cached) reason = "Exact raw query is absent";
    else if (
      !Number.isFinite(current) ||
      !Number.isFinite(observed) ||
      observed > current ||
      current - observed >= maximumAge
    )
      reason = "Raw query observation is expired or invalid";
    else if (hash(cached.source.text) !== cached.source.contentHash)
      reason = "Raw query body changed";
    if (reason || !cached) {
      this.misses.push({
        url: diagnosticUrl(url),
        reason: reason ?? "Exact raw query is absent",
      });
      throw new CaliforniaFinanceCacheUnavailable(
        url,
        reason ?? "Exact raw query is absent",
      );
    }
    this.hits.push({
      candidateId,
      sourceId: cached.source.id,
      url,
      contentHash: cached.source.contentHash,
      fetchedAt: cached.source.fetchedAt,
      lookupAt,
      cacheOwners: [...cached.owners].sort(),
    });
    return structuredClone(cached.source);
  }

  beforeDns(url: string, stage = "initial") {
    if (isFecApiUrl(url)) {
      this.denials.push({ url: diagnosticUrl(url), stage });
      throw new CaliforniaFinanceCacheUnavailable(
        url,
        "FEC API network acquisition is forbidden",
      );
    }
  }

  beforeTransport(url: string) {
    this.beforeDns(url, "transport");
    this.transports++;
  }

  complete(candidateId: string) {
    this.completeMembers.add(candidateId);
  }

  assertReady(candidateIds: string[]) {
    if (
      this.misses.length ||
      this.denials.length ||
      candidateIds.some(
        (id) =>
          !this.completeMembers.has(id) ||
          !this.hits.some((hit) => hit.candidateId === id),
      )
    )
      throw new CaliforniaFinanceCacheUnavailable(
        "https://api.open.fec.gov/",
        "The complete race did not pass cache-only acquisition",
      );
  }

  receipt() {
    return {
      schemaVersion: 1,
      guardVersion: "fec-api-denial-v1",
      acquisitionMode: "finance_cache_only" as const,
      apiCacheHits: structuredClone(this.hits),
      cacheMisses: structuredClone(this.misses),
      deniedApiRequests: structuredClone(this.denials),
      nonApiTransportAttempts: this.transports,
      apiTransportAttempts: 0,
      completeCandidateIds: [...this.completeMembers].sort(),
      scope:
        "Cache hits retain original observations. Denials occur before API DNS or transport; non-API static HTTP remains enabled. These counters are source-acquisition boundaries, not a packet trace.",
    };
  }
}
