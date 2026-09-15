import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const BASE = "https://www.googleapis.com/civicinfo/v2/";
const fields = [
  "contests",
  "pollingLocations",
  "earlyVoteSites",
  "dropOffLocations",
  "state",
];
const count = (value) => (Array.isArray(value) ? value.length : 0);

export function summarize(body, requestedElectionId = null) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Invalid response");
  const election = body.election?.id
    ? {
        id: String(body.election.id),
        name: body.election.name ?? null,
        electionDay: body.election.electionDay ?? null,
      }
    : null;
  const otherElections = (
    Array.isArray(body.otherElections) ? body.otherElections : []
  ).map((e) => ({
    id: String(e.id),
    name: e.name ?? null,
    electionDay: e.electionDay ?? null,
  }));
  const availability = Object.fromEntries(
    fields.map((f) => [
      f,
      {
        present: Object.hasOwn(body, f),
        count: count(body[f]),
      },
    ]),
  );
  const selectionRequired = !requestedElectionId && otherElections.length > 0;
  const mismatch = requestedElectionId && election?.id !== requestedElectionId;
  return {
    state: mismatch
      ? "provider_error"
      : selectionRequired
        ? "election_selection_required"
        : count(body.contests)
          ? "data_available"
          : election
            ? "election_known_ballot_unavailable"
            : "no_data_found",
    election,
    otherElections,
    availability,
    mailOnly: typeof body.mailOnly === "boolean" ? body.mailOnly : null,
    error: mismatch ? "election_id_mismatch" : null,
  };
}

export async function measure(
  samples,
  { key, fetcher = fetch, now = () => new Date().toISOString() } = {},
) {
  if (!Array.isArray(samples) || samples.length < 1 || samples.length > 30)
    throw new Error("Expected 1–30 samples");
  const ids = new Set();
  for (const s of samples) {
    if (
      !/^[a-z0-9-]{1,60}$/.test(s.id) ||
      ids.has(s.id) ||
      !/^[A-Z]{2}$/.test(s.state)
    )
      throw new Error("Invalid sample metadata");
    ids.add(s.id);
    if (s.electionId != null && !/^\d+$/.test(s.electionId))
      throw new Error("Invalid election ID");
  }
  const rows = [];
  for (const sample of samples) {
    const row = {
      sampleId: sample.id,
      stateCode: sample.state,
      checkedAt: now(),
      requestedElectionId: sample.electionId ?? null,
      endpoint: `${BASE}voterinfo`,
      enrichment: "not_run",
      officialComparison: "pending",
      httpStatus: null,
    };
    if (!key) {
      rows.push({ ...row, state: "not_measured", error: "missing_credential" });
      continue;
    }
    if (
      typeof sample.address !== "string" ||
      !sample.address.trim() ||
      sample.address.length > 300
    ) {
      rows.push({
        ...row,
        state: "not_measured",
        error: "missing_or_invalid_sample_address",
      });
      continue;
    }
    const url = new URL("voterinfo", BASE);
    url.searchParams.set("key", key);
    url.searchParams.set("address", sample.address.trim());
    if (sample.electionId)
      url.searchParams.set("electionId", sample.electionId);
    try {
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      row.httpStatus = response.status;
      // Never persist provider error text, request URLs, or normalized street addresses.
      if (!response.ok)
        rows.push({
          ...row,
          state: "provider_error",
          error: `http_${response.status}`,
        });
      else {
        const body = await response.json();
        if (body.error) throw new Error("Provider error envelope");
        rows.push({ ...row, ...summarize(body, sample.electionId ?? null) });
      }
    } catch {
      rows.push({
        ...row,
        state: "provider_error",
        error: "transport_or_response_error",
      });
    }
  }
  return { schemaVersion: 1, measuredAt: now(), requestLimit: 30, rows };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const input = process.argv[2] ?? new URL("./samples.json", import.meta.url);
    const samples = JSON.parse(await readFile(input, "utf8"));
    const report = await measure(samples, {
      key: process.env.GOOGLE_CIVIC_API_KEY,
    });
    console.log(JSON.stringify(report, null, 2));
    if (
      report.rows.some((r) =>
        ["not_measured", "provider_error"].includes(r.state),
      )
    )
      process.exitCode = 2;
  } catch {
    console.error("Coverage run failed: check input file and sample metadata.");
    process.exitCode = 1;
  }
}
