import { createHash } from "node:crypto";

import type {
  CaliforniaRaceTarget,
  CaliforniaRosterSnapshot,
  ResearchSource,
  SanJoseScopeCrosswalk,
} from "@acme/validators";
import {
  californiaRosterSnapshotSchema,
  sanJoseScopeCrosswalkSchema,
} from "@acme/validators";

const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const offices: Record<
  string,
  {
    name: string;
    family: CaliforniaRaceTarget["officeFamily"];
    district?: string;
  }
> = {
  "02": { name: "Governor", family: "statewide" },
  "03": { name: "Lieutenant Governor", family: "statewide" },
  "04": { name: "Secretary of State", family: "statewide" },
  "05": { name: "Controller", family: "statewide" },
  "06": { name: "Treasurer", family: "statewide" },
  "07": { name: "Attorney General", family: "statewide" },
  "08": { name: "Insurance Commissioner", family: "statewide" },
  "09": {
    name: "Board of Equalization Member",
    family: "board_of_equalization",
    district: "boe",
  },
  "11": {
    name: "United States Representative",
    family: "us_house",
    district: "cd",
  },
  "12": { name: "State Senate", family: "state_senate", district: "sldu" },
  "13": {
    name: "State Assembly Member",
    family: "state_assembly",
    district: "sldl",
  },
  "14": { name: "Supreme Court Justice", family: "judicial_retention" },
  "15": { name: "Court of Appeal Justice", family: "judicial_retention" },
  "16": { name: "Superintendent of Public Instruction", family: "statewide" },
};
const counties =
  "Alameda|Alpine|Amador|Butte|Calaveras|Colusa|Contra Costa|Del Norte|El Dorado|Fresno|Glenn|Humboldt|Imperial|Inyo|Kern|Kings|Lake|Lassen|Los Angeles|Madera|Marin|Mariposa|Mendocino|Merced|Modoc|Mono|Monterey|Napa|Nevada|Orange|Placer|Plumas|Riverside|Sacramento|San Benito|San Bernardino|San Diego|San Francisco|San Joaquin|San Luis Obispo|San Mateo|Santa Barbara|Santa Clara|Santa Cruz|Shasta|Sierra|Siskiyou|Solano|Sonoma|Stanislaus|Sutter|Tehama|Trinity|Tulare|Tuolumne|Ventura|Yolo|Yuba".split(
    "|",
  );
const countySources: Record<string, string> = {
  "06001": "https://acvote.alamedacountyca.gov/index",
  "06003": "http://www.alpinecountyca.gov/index.aspx?NID=388",
  "06005": "https://www.amadorcounty.gov/government/elections",
  "06007": "https://buttevotes.net/35/Elections",
  "06009": "http://elections.calaverasgov.us/",
  "06011": "http://www.countyofcolusa.org/index.aspx?NID=197",
  "06013": "https://www.contracostavote.gov/elections/",
  "06015": "https://www.co.del-norte.ca.us/departments/Elections",
  "06017": "https://www.eldoradocounty.ca.gov/County-Government/Elections",
  "06019":
    "https://www.fresnocountyca.gov/Departments/County-ClerkRegistrar-of-Voters/Elections",
  "06021": "https://www.countyofglenn.net/dept/elections/welcome",
  "06023": "https://humboldtgov.org/890/Elections-Voter-Registration",
  "06025": "https://elections.imperialcounty.org/",
  "06027": "https://elections.inyocounty.us/",
  "06029": "https://www.kernvote.com/",
  "06031": "https://www.countyofkings.com/departments/administration/elections",
  "06033": "https://www.lakecountyca.gov/818/Registrar-of-Voters",
  "06035": "http://www.lassencounty.org/dept/county-clerk-recorder/elections/",
  "06037": "https://www.lavote.gov/home/voting-elections",
  "06039": "https://votemadera.com/",
  "06041": "https://www.marincounty.gov/departments/elections",
  "06043": "http://www.mariposacounty.org/87/Elections",
  "06045":
    "https://www.mendocinocounty.gov/government/assessor-county-clerk-recorder-elections/elections",
  "06047": "https://www.countyofmerced.com/3878/Elections",
  "06049": "https://www.countyofmodoc.gov/554/Elections",
  "06051": "https://monocounty.ca.gov/elections",
  "06053":
    "https://www.countyofmonterey.gov/government/departments-a-h/elections/home",
  "06055": "https://www.napacounty.gov/396/Elections",
  "06057": "https://www.nevadacountyca.gov/3446/Elections",
  "06059": "https://ocvote.gov/",
  "06061": "http://www.placercountyelections.gov",
  "06063": "https://www.plumascounty.us/142/Elections-Division-Home",
  "06065": "https://www.voteinfo.net/",
  "06067": "https://elections.saccounty.gov/Pages/default.aspx",
  "06069": "https://www.sanbenitocounty-ca-cre.gov/elections",
  "06071": "https://elections.sbcounty.gov/",
  "06073": "https://www.sdvote.com/",
  "06075": "https://sf.gov/departments/department-elections",
  "06077": "https://www.sjgov.org/department/rov/",
  "06079": "https://www.slocounty.ca.gov/Departments/Clerk-Recorder.aspx",
  "06081": "https://smcacre.gov/elections",
  "06083": "https://www.countyofsb.org/164/Elections",
  "06085": "https://vote.santaclaracounty.gov/home",
  "06087": "https://votescount.santacruzcountyca.gov/",
  "06089": "https://elections.shastacounty.gov/",
  "06091": "https://www.sierracounty.ca.gov/214/Elections",
  "06093": "https://www.siskiyoucounty.gov/elections",
  "06095": "https://www.solanocounty.gov/government/registrar-voters",
  "06097":
    "https://sonomacounty.ca.gov/administrative-support-and-fiscal-services/clerk-recorder-assessor-registrar-of-voters/registrar-of-voters",
  "06099": "http://stanvote.gov/",
  "06101":
    "https://www.sutter.gov/government/county-departments/clerk-recorder/elections",
  "06103": "https://www.tehama.gov/government/departments/elections/",
  "06105": "https://www.trinitycounty.org/214/Elections",
  "06107": "https://tularecounty.ca.gov/elections",
  "06109": "https://www.tuolumnecounty.ca.gov/194/Election-Information",
  "06111": "https://clerkrecorder.venturacounty.gov/elections/elections/",
  "06113": "https://www.yoloelections.org/",
  "06115": "https://www.yuba.gov/departments/elections/current_election.php",
};
const parties: Record<string, string> = {
  "01": "Democratic",
  "02": "Republican",
  "04": "Green",
  "05": "Libertarian",
  "08": "Peace and Freedom",
  "13": "Non-Partisan",
  "14": "No Party Preference",
  "15": "Non-Partisan",
};
const normalized = (s: string) =>
  s
    .normalize("NFKC")
    .replaceAll("*", "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("en-US");
const ordinals = [
  "",
  "First",
  "Second",
  "Third",
  "Fourth",
  "Fifth",
  "Sixth",
  "Seventh",
  "Eighth",
];

function certifyRace(race: CaliforniaRaceTarget, text: string) {
  if (race.kind === "retention") {
    for (const member of race.members) {
      const matches = [
        ...text.matchAll(/• For ([\s\S]*?)(?=• For |$)/g),
      ].filter((m) =>
        normalized(m[1]!).includes(` ${normalized(member.name)} BE ELECTED`),
      );
      if (matches.length !== 1)
        throw new Error(`Ambiguous certified judicial identity ${member.name}`);
      const entry = matches[0]![1]!;
      race.office = entry.split("\n")[0]!.trim();
      if (race.sourceProof)
        race.sourceProof.locator = `${race.office}; ${member.name}`;
      if (race.sourceContestId.startsWith("14")) {
        if (!entry.includes("Supreme Court"))
          throw new Error("Judicial court mismatch");
      } else {
        const district = Number(race.sourceContestId.slice(6, 8));
        const division = Number(race.sourceContestId.slice(8, 10));
        race.district = `${ordinals[district]} Appellate District${division > 0 ? `, Division ${["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"][division]}` : ""}`;
        race.jurisdictionLabel = `California · ${race.district}`;
        if (
          !entry.includes(`Court of Appeal, ${ordinals[district]} District`) ||
          (division > 0 &&
            !entry.includes(
              `Division ${["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"][division]}`,
            ))
        )
          throw new Error(`Judicial district mismatch ${member.name}`);
      }
    }
    return;
  }
  const heading = race.office;
  const lines = text.split(/\r?\n/);
  const indices = lines.flatMap((line, i) =>
    line.trim() === heading ? [i] : [],
  );
  if (indices.length !== 1)
    throw new Error(`Missing or duplicate certified office ${heading}`);
  const start = indices[0]! + 1;
  const next = lines.findIndex(
    (line, i) =>
      i >= start &&
      /^(Governor|Lieutenant Governor|Secretary of State|Controller|Treasurer|Attorney General|Insurance Commissioner|Superintendent of Public Instruction|Board of Equalization Member District \d+|United States Representative District \d+|State Senate District \d+|State Assembly Member District \d+|SUPREME COURT|Supreme Court)$/.test(
        line,
      ),
  );
  const section = lines.slice(start, next < 0 ? undefined : next);
  const names = section.flatMap((line) =>
    / (Democratic|Republican|No Party Preference|Non-Partisan|Libertarian|Green|American Independent|Peace and Freedom)$/.test(
      line.trim(),
    )
      ? [
          normalized(
            line.replace(
              / (Democratic|Republican|No Party Preference|Non-Partisan|Libertarian|Green|American Independent|Peace and Freedom)$/,
              "",
            ),
          ),
        ]
      : [],
  );
  if (
    names.length !== race.members.length ||
    race.members.some((m) => !names.includes(normalized(m.name)))
  )
    throw new Error(`Certified membership mismatch ${heading}`);
}

export function decodeCaliforniaRoster(input: {
  bytes: Uint8Array;
  fetchedAt: string;
  certification: ResearchSource;
  electionDate?: string;
}): CaliforniaRosterSnapshot {
  const electionDate = input.electionDate ?? "2026-11-03";
  if (
    input.bytes.length > 5_000_000 ||
    input.certification.text.length > 5_000_000
  )
    throw new Error("Roster exceeds source byte bound");
  if (
    electionDate !== "2026-11-03" ||
    !input.certification.text.includes("November 3, 2026")
  )
    throw new Error("Certified election date mismatch");
  const text = new TextDecoder("windows-1252", { fatal: true }).decode(
    input.bytes,
  );
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(text))
    throw new Error("Unsupported SOS control byte");
  const lines = text.trim().split(/\r?\n/);
  const records = lines.map((line, i) => {
    if (!/^\[[^\[\]]+\]$/.test(line))
      throw new Error(`Malformed SOS row ${i + 1}`);
    return line.slice(1, -1).split("|");
  });
  const first = records[0]!;
  const last = records.at(-1)!;
  if (
    first[0] !== "B" ||
    last[0] !== "E" ||
    first.length !== 5 ||
    last.length !== 5 ||
    first[1] !== "CAS" ||
    last[1] !== "CAS" ||
    first[3] !== last[3] ||
    first[4] !== last[4]
  )
    throw new Error("Invalid SOS envelope");
  const races = new Map<string, CaliforniaRaceTarget>();
  const seen = new Set<string>();
  const excludedContests: CaliforniaRosterSnapshot["excludedContests"] = [];
  for (let i = 1; i < records.length - 1; i++) {
    const row = records[i]!;
    const code = row[3]!;
    if (
      row[0] !== "C" ||
      row[1] !== "CAS" ||
      row.length !== (code.startsWith("19") ? 11 : 12) ||
      row[2] !== String(i + 1) ||
      !/^\d{12}$/.test(code)
    )
      throw new Error(`Malformed SOS candidate row ${i + 1}`);
    if (code.startsWith("19")) {
      if (row[4] || !row[10]) throw new Error("Malformed proposition");
      if (excludedContests.some((e) => e.sourceContestId === code))
        throw new Error("Duplicate proposition");
      excludedContests.push({ sourceContestId: code, reason: "proposition" });
      continue;
    }
    const config = offices[code.slice(0, 2)];
    if (!config || !/^\d+$/.test(row[4]!) || !row[10] || !row[6])
      throw new Error("Unknown or incomplete candidate-bearing contest");
    if (!parties[row[9]!]) throw new Error("Unknown SOS candidate party code");
    const contestId = `ca-sos:${electionDate}:${code}`;
    const candidateId = `${contestId}:${row[4]}`;
    if (seen.has(candidateId))
      throw new Error("Duplicate SOS candidate identity");
    seen.add(candidateId);
    const district = config.district ? String(Number(code.slice(6, 8))) : null;
    if (config.district && (!district || district === "0"))
      throw new Error("Missing district");
    const jurisdiction = `ocd-division/country:us/state:ca${config.district && config.district !== "boe" ? `/${config.district}:${district}` : ""}`;
    const office = config.district
      ? `${config.name} District ${district}`
      : config.family === "judicial_retention"
        ? `${config.name} · Seat ${code}`
        : config.name;
    const race = races.get(code) ?? {
      raceKey:
        code === "110000170000"
          ? "ca-house-17-2026"
          : code === "030000000000"
            ? "ca-lieutenant-governor-2026"
            : `ca-sos-${electionDate}-${code}`,
      contestId,
      jurisdiction,
      jurisdictionLabel: district
        ? `California · District ${district}`
        : "California",
      electionDate,
      sourceContestId: code,
      officeFamily: config.family,
      office,
      district,
      kind:
        config.family === "judicial_retention"
          ? ("retention" as const)
          : ("election" as const),
      rosterDigest: "",
      rosterSourceUrl: input.certification.url,
      sourceProof: {
        url: input.certification.url,
        contentHash: hash(input.certification.text),
        locator: office,
      },
      members: [],
    };
    race.members.push({
      identity: { candidateId, contestId, jurisdiction, electionDate },
      candidateId,
      name: row[10],
      sourceCandidateId: row[4]!,
      partyCode: row[9]!,
      party: parties[row[9]!]!,
      ballotStatus: "on_ballot",
    });
    races.set(code, race);
  }
  if (last[2] !== String(records.length))
    throw new Error("SOS trailer record count mismatch");
  const targets = [...races.values()].sort((a, b) =>
    a.contestId.localeCompare(b.contestId),
  );
  for (const race of targets) {
    race.members.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
    race.rosterDigest = hash(JSON.stringify(race.members));
    certifyRace(race, input.certification.text);
  }
  const textHash = hash(text);
  const certificationHash = hash(input.certification.text);
  return californiaRosterSnapshotSchema.parse({
    schemaVersion: 1,
    id: hash(JSON.stringify({ electionDate, textHash, certificationHash })),
    electionDate,
    scope: "ca_sos_certified",
    scopeLabel:
      "California state-certified candidates. County and city rosters are not yet enumerated.",
    source: {
      url: "https://media.sos.ca.gov/media/C26GG.txt",
      byteHash: hash(input.bytes),
      textHash,
      fetchedAt: input.fetchedAt,
      encoding: "windows-1252",
      text,
    },
    certification: {
      byteHash: input.certification.byteHash,
      url: input.certification.url,
      textHash: certificationHash,
      fetchedAt: input.certification.fetchedAt,
      text: input.certification.text,
    },
    races: targets,
    excludedContests,
    countyCoverage: counties.map((name, i) => ({
      fips: `06${String(i * 2 + 1).padStart(3, "0")}`,
      name,
      status: "not_enumerated",
      sourceUrl: countySources[`06${String(i * 2 + 1).padStart(3, "0")}`],
    })),
  });
}

export interface SantaClaraLocalContest {
  sourceContestId: string;
  office: string;
  onBallot: boolean;
  voteFor: number;
  members: { sourceOrdinal: string; name: string; statementFiled: boolean }[];
}

export function parseSantaClaraQualifiedRoster(source: ResearchSource) {
  if (
    source.text.length > 5_000_000 ||
    !source.text.includes("General Election - 11/3/2026")
  )
    throw new Error("Wrong or oversized Santa Clara roster");
  if (hash(source.text) !== source.contentHash)
    throw new Error("Santa Clara roster archive hash mismatch");
  const matches = [
    ...source.text.matchAll(
      /^(\d{4}) (.*?) On Ballot: (Yes|No) Vote For: (\d+)\s*$/gm,
    ),
  ];
  const contests: SantaClaraLocalContest[] = matches.map((match, index) => {
    const section = source.text.slice(
      match.index! + match[0].length,
      matches[index + 1]?.index,
    );
    const members = [
      ...section.matchAll(
        /^Qualified (\d+) (.+?) Candidate Stmt Filed\? (Yes|No)(?:\s|$)/gm,
      ),
    ].map((m) => ({
      sourceOrdinal: m[1]!,
      name: m[2]!,
      statementFiled: m[3] === "Yes",
    }));
    if (
      !members.length ||
      new Set(members.map((m) => m.sourceOrdinal)).size !== members.length ||
      members.some((m) => Number(m.sourceOrdinal) < 1)
    )
      throw new Error(
        `Incomplete or duplicate Santa Clara memberships ${match[1]}`,
      );
    const voteFor = Number(match[4]);
    if (voteFor < 1 || voteFor > 20)
      throw new Error("Invalid local vote-for limit");
    return {
      sourceContestId: match[1]!,
      office: match[2]!,
      onBallot: match[3] === "Yes",
      voteFor,
      members,
    };
  });
  const totals = [
    ...source.text.matchAll(/^(?:Grand Total|Total Qualified): (\d+)\s*$/gm),
  ].map((m) => Number(m[1]));
  const actual = contests.reduce((n, c) => n + c.members.length, 0);
  if (
    !contests.length ||
    new Set(contests.map((c) => c.sourceContestId)).size !== contests.length ||
    totals.length !== 2 ||
    totals.some((n) => n !== actual)
  )
    throw new Error("Santa Clara qualified roster footer mismatch");
  return contests;
}

export function appendSanJoseRoster(
  snapshot: CaliforniaRosterSnapshot,
  input: {
    source: ResearchSource;
    writeInSource?: ResearchSource;
    reviewedCrosswalk?: SanJoseScopeCrosswalk;
    proofSources?: ResearchSource[];
    selections: {
      sourceContestId: string;
      jurisdiction: string;
      jurisdictionLabel: string;
      district: string | null;
      proofSource: ResearchSource;
      proofExcerpt: string;
      proofLocator: string;
    }[];
    status: "pending" | "verified";
    notes: string;
  },
): CaliforniaRosterSnapshot {
  if (
    snapshot.electionDate !== "2026-11-03" ||
    snapshot.races.some((r) => r.officeFamily === "local")
  )
    throw new Error(
      "Local roster requires an unextended matching state snapshot",
    );
  const contests = parseSantaClaraQualifiedRoster(input.source);
  if (input.reviewedCrosswalk)
    checkedSanJoseCrosswalk(
      input.reviewedCrosswalk,
      input.source,
      input.proofSources ?? [],
    );
  const writeIns = input.writeInSource
    ? parseSantaClaraQualifiedWriteIns(input.writeInSource)
    : [];
  if (
    new Set(input.selections.map((s) => s.sourceContestId)).size !==
    input.selections.length
  )
    throw new Error("Duplicate San José contest selection");
  const localRaces: CaliforniaRaceTarget[] = input.selections.map(
    (selection) => {
      const contest = contests.find(
        (c) => c.sourceContestId === selection.sourceContestId,
      );
      if (!contest || !contest.onBallot)
        throw new Error("San José selection is not an on-ballot contest");
      const proof = selection.proofSource;
      if (
        !input.reviewedCrosswalk &&
        (!selection.proofExcerpt.trim() ||
          !proof.text.includes(selection.proofExcerpt) ||
          hash(proof.text) !== proof.contentHash ||
          !/SAN JOS[ÉE]/u.test(normalized(selection.proofExcerpt)))
      )
        throw new Error(
          "San José territorial inclusion requires exact archived source proof",
        );
      const contestId = `ca-scc:${snapshot.electionDate}:${contest.sourceContestId}`;
      const members: CaliforniaRaceTarget["members"] = contest.members.map(
        (m) => {
          const sourceCandidateId = `qualified-row:${m.sourceOrdinal}@${input.source.contentHash}`;
          const candidateId = `${contestId}:${sourceCandidateId}`;
          return {
            identity: {
              candidateId,
              contestId,
              jurisdiction: selection.jurisdiction,
              electionDate: snapshot.electionDate,
            },
            candidateId,
            name: m.name,
            sourceCandidateId,
            partyCode: "",
            party: null,
            ballotStatus: "on_ballot" as const,
            sourceProof: {
              url: input.source.url,
              contentHash: input.source.contentHash,
              excerpt: `Qualified ${m.sourceOrdinal} ${m.name} Candidate Stmt Filed? ${m.statementFiled ? "Yes" : "No"}`,
              locator: `Contest ${contest.sourceContestId}; Qualified ${m.sourceOrdinal}`,
            },
          };
        },
      );
      for (const member of writeIns.filter(
        (m) => m.sourceContestId === selection.sourceContestId,
      )) {
        const candidateId = `${contestId}:write-in:${member.sourceCandidateId}`;
        members.push({
          identity: {
            candidateId,
            contestId,
            jurisdiction: selection.jurisdiction,
            electionDate: snapshot.electionDate,
          },
          candidateId,
          name: member.name,
          sourceCandidateId: member.sourceCandidateId,
          partyCode: "",
          party: null,
          ballotStatus: "qualified_write_in",
          sourceProof: {
            url: input.writeInSource!.url,
            contentHash: input.writeInSource!.contentHash,
            excerpt: member.excerpt,
            locator: `Contest ${contest.sourceContestId}, Cand ID ${member.sourceCandidateId}, qualified ${member.qualifiedDate}`,
          },
        });
      }
      for (const member of members) {
        const memberSource =
          member.ballotStatus === "qualified_write_in"
            ? input.writeInSource
            : input.source;
        if (
          !member.sourceProof ||
          !memberSource?.text.includes(member.sourceProof.excerpt)
        )
          throw new Error(
            "Local membership proof excerpt is not in its immutable archive",
          );
      }
      return {
        raceKey: `ca-scc-${snapshot.electionDate}-${contest.sourceContestId}`,
        contestId,
        jurisdiction: selection.jurisdiction,
        jurisdictionLabel: selection.jurisdictionLabel,
        electionDate: snapshot.electionDate,
        sourceContestId: contest.sourceContestId,
        officeFamily: "local",
        office: contest.office,
        district: selection.district,
        kind: "election",
        rosterDigest: hash(JSON.stringify(members)),
        voteFor: contest.voteFor,
        territoryProof: input.reviewedCrosswalk
          ? {
              kind: "reviewed_crosswalk" as const,
              ...input.reviewedCrosswalk.review,
              method: input.reviewedCrosswalk.method,
              reason: input.reviewedCrosswalk.entries.find(
                (e) => e.sourceContestId === contest.sourceContestId,
              )!.reason,
              proofs: input.reviewedCrosswalk.entries.find(
                (e) => e.sourceContestId === contest.sourceContestId,
              )!.proofs,
            }
          : {
              url: proof.url,
              contentHash: proof.contentHash,
              excerpt: selection.proofExcerpt,
              locator: selection.proofLocator,
            },
        rosterSourceUrl: input.source.url,
        sourceProof: {
          url: input.source.url,
          contentHash: input.source.contentHash,
          locator: `Contest ${contest.sourceContestId}; full on-ballot qualified membership`,
        },
        members,
      };
    },
  );
  const sourceProofs = [
    input.source,
    ...(input.writeInSource ? [input.writeInSource] : []),
    ...(input.proofSources ?? []),
    ...input.selections.map((s) => s.proofSource),
  ].filter(
    (source, i, all) =>
      all.findIndex(
        (s) => s.url === source.url && s.contentHash === source.contentHash,
      ) === i,
  );
  return californiaRosterSnapshotSchema.parse({
    ...snapshot,
    id: hash(
      JSON.stringify({
        stateSnapshotId: snapshot.id,
        localSourceHash: input.source.contentHash,
        writeInSourceHash: input.writeInSource?.contentHash,
        crosswalkReview: input.reviewedCrosswalk?.review,
        notes: input.notes,
        selections: input.selections.map((s) => ({
          sourceContestId: s.sourceContestId,
          jurisdiction: s.jurisdiction,
          proofHash: s.proofSource.contentHash,
          proofExcerpt: s.proofExcerpt,
        })),
        status: input.status,
      }),
    ),
    scope: "ca_sos_certified_and_san_jose",
    scopeLabel:
      "California state-certified candidates and verified local contests serving San José. Other California local contests are outside this scope.",
    races: [...snapshot.races, ...localRaces],
    additionalSources: sourceProofs,
    localCoverage: {
      scope: "san_jose",
      status: input.status,
      expectedCandidates:
        input.status === "verified"
          ? localRaces.reduce((n, r) => n + r.members.length, 0)
          : null,
      expectedRaces: input.status === "verified" ? localRaces.length : null,
      notes: input.notes,
    },
  });
}

export function parseSantaClaraQualifiedWriteIns(source: ResearchSource) {
  if (
    source.text.length > 5_000_000 ||
    hash(source.text) !== source.contentHash
  )
    throw new Error("Invalid write-in source archive");
  const text = source.text.replace(/^L\d+@P[\d-]+:\s?/gm, "");
  if (!/General Election.*11\/0?3\/2026/i.test(text))
    throw new Error("Write-in source election is not verified");
  const records = [...text.matchAll(/^\s*(\d{4}) ([^\n]+)\n/gm)];
  const results: {
    sourceContestId: string;
    sourceCandidateId: string;
    name: string;
    qualifiedDate: string;
    excerpt: string;
  }[] = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;
    const section = text.slice(record.index!, records[i + 1]?.index);
    for (const member of section.matchAll(
      /Candidate\(s\): ([^\n]+) \(Write-in\)([\s\S]*?)(?=Candidate\(s\):|$)/g,
    )) {
      const fields =
        /Qualified Date:\s*(?:User Codes:\s*)?Cand ID:\s*(\d{1,2}\/\d{1,2}\/2026)\s+(\d+)\s/.exec(
          member[2]!,
        );
      if (!fields)
        throw new Error(
          "Write-in qualification or official candidate ID missing",
        );
      const rawMember = member[0];
      results.push({
        sourceContestId: record[1]!,
        sourceCandidateId: fields[2]!,
        name: member[1]!,
        qualifiedDate: fields[1]!,
        excerpt: source.text.includes(rawMember)
          ? rawMember
          : `Candidate(s): ${member[1]} (Write-in)`,
      });
    }
  }
  if (
    new Set(results.map((r) => `${r.sourceContestId}:${r.sourceCandidateId}`))
      .size !== results.length
  )
    throw new Error("Duplicate write-in identity");
  return results;
}

function canonicalCrosswalkJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(canonicalCrosswalkJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalCrosswalkJson(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function sanJoseScopeCrosswalkDigest(
  value: Omit<SanJoseScopeCrosswalk, "review">,
) {
  return hash(canonicalCrosswalkJson(value));
}
function checkedSanJoseCrosswalk(
  value: unknown,
  source: ResearchSource,
  proofSources: ResearchSource[],
) {
  const crosswalk = sanJoseScopeCrosswalkSchema.parse(value);
  const { review, ...document } = crosswalk;
  if (
    review.digest !== sanJoseScopeCrosswalkDigest(document) ||
    source.contentHash !== crosswalk.rosterSourceHash
  )
    throw new Error("San José crosswalk review or source digest mismatch");
  const contests = parseSantaClaraQualifiedRoster(source);
  if (
    new Set(crosswalk.entries.map((e) => e.sourceContestId)).size !== 129 ||
    crosswalk.entries.some(
      (e) => !contests.some((c) => c.sourceContestId === e.sourceContestId),
    )
  )
    throw new Error("San José crosswalk must account for every county contest");
  for (const entry of crosswalk.entries) {
    for (const ref of entry.proofs) {
      const original = [source, ...proofSources].find(
        (original) =>
          original.url === ref.url && original.contentHash === ref.contentHash,
      );
      if (
        original?.format === "image" &&
        (!ref.byteHash ||
          !original.binaryBase64 ||
          hash(Buffer.from(original.binaryBase64, "base64")) !== ref.byteHash)
      )
        throw new Error(
          "Image territorial proof requires exact archived raw bytes",
        );
    }

    const contest = contests.find(
      (c) => c.sourceContestId === entry.sourceContestId,
    )!;
    if (
      (!contest.onBallot && entry.status !== "off_ballot") ||
      (contest.onBallot && entry.status === "off_ballot")
    )
      throw new Error("San José crosswalk ballot-status mismatch");
    if (
      entry.status === "include" &&
      (!entry.jurisdiction || !entry.jurisdictionLabel)
    )
      throw new Error("Included local contest lacks verified jurisdiction");
    for (const ref of entry.proofs)
      if (
        ![source, ...proofSources].some(
          (p) =>
            p.url === ref.url &&
            p.contentHash === ref.contentHash &&
            (!ref.byteHash || p.byteHash === ref.byteHash) &&
            hash(p.text) === p.contentHash,
        )
      )
        throw new Error("San José crosswalk proof changed or is not archived");
  }
  return crosswalk;
}
export function appendReviewedSanJoseRoster(
  snapshot: CaliforniaRosterSnapshot,
  input: {
    source: ResearchSource;
    writeInSource?: ResearchSource;
    proofSources: ResearchSource[];
    crosswalk: unknown;
  },
) {
  const crosswalk = checkedSanJoseCrosswalk(
    input.crosswalk,
    input.source,
    input.proofSources,
  );
  const selections = crosswalk.entries
    .filter((e) => e.status === "include")
    .map((entry) => {
      const proofSource = [input.source, ...input.proofSources].find(
        (p) =>
          p.url === entry.proofs[0]!.url &&
          p.contentHash === entry.proofs[0]!.contentHash,
      )!;
      return {
        sourceContestId: entry.sourceContestId,
        jurisdiction: entry.jurisdiction!,
        jurisdictionLabel: entry.jurisdictionLabel!,
        district: entry.district ?? null,
        proofSource,
        proofExcerpt:
          "Reviewed territorial crosswalk; this is not an official source quotation.",
        proofLocator: crosswalk.review.digest,
      };
    });
  const roster = appendSanJoseRoster(snapshot, {
    source: input.source,
    writeInSource: input.writeInSource,
    proofSources: input.proofSources,
    selections,
    reviewedCrosswalk: crosswalk,
    status: crosswalk.entries.some((e) => e.status === "pending")
      ? "pending"
      : "verified",
    notes: crosswalk.entries.some((e) => e.status === "pending")
      ? "San José territorial census is incomplete. Verified races are discoverable; pending races remain in the reviewed scope ledger."
      : "All county contests reconciled against the reviewed San José territorial crosswalk.",
  });
  const county = parseSantaClaraQualifiedRoster(input.source);
  return californiaRosterSnapshotSchema.parse({
    ...roster,
    localCrosswalk: crosswalk,
    localCoverage: {
      ...roster.localCoverage,
      pendingRaces: crosswalk.entries.filter((e) => e.status === "pending")
        .length,
      pendingCandidates: crosswalk.entries
        .filter((e) => e.status === "pending")
        .reduce(
          (n, e) =>
            n +
            (county.find((c) => c.sourceContestId === e.sourceContestId)
              ?.members.length ?? 0),
          0,
        ),
    },
  });
}

export async function refreshReviewedSanJoseRoster(
  current: CaliforniaRosterSnapshot,
  freshState: CaliforniaRosterSnapshot,
  fetchSource: (
    id: string,
    url: string,
    publisher: string,
    format: ResearchSource["format"],
  ) => Promise<ResearchSource>,
) {
  if (!current.localCrosswalk)
    throw new Error("San José snapshot lacks a reviewed crosswalk");
  const prior = current.additionalSources ?? [];
  if (current.localPrimary?.kind === "scc_clarity") {
    const versionArchive = prior.find(
      (source) => source.url === current.localPrimary!.currentVersionURL,
    );
    if (!versionArchive)
      throw new Error("Clarity current version archive incomplete");
    const currentVersion = await fetchSource(
      versionArchive.id,
      versionArchive.url,
      versionArchive.publisher,
      versionArchive.format,
    );
    const version = currentVersion.text.trim();
    if (!/^\d{6}$/.test(version))
      throw new Error("Invalid current Clarity report version");
    const fresh: ResearchSource[] = [currentVersion];
    for (const source of prior.filter(
      (source) => source.url !== versionArchive.url,
    )) {
      const url = source.url.replace(
        /^(https:\/\/results\.enr\.clarityelections\.com\/CA\/Santa_Clara\/127570\/)\d{6}(\/)/,
        `$1${version}$2`,
      );
      fresh.push(
        await fetchSource(source.id, url, source.publisher, source.format),
      );
    }
    const { renewReviewedClaritySanJoseRoster } =
      await import("./california-clarity.js");
    return renewReviewedClaritySanJoseRoster(current, freshState, fresh);
  }
  const county =
    prior.find((s) => s.id === "san-jose-qualified-roster") ??
    prior.find((s) =>
      s.text.includes("Final Qualified List of Local Eligible Candidates"),
    );
  const writeIns = prior.find((s) =>
    s.text.includes("Final Qualified List of Local Write-In Candidates"),
  );
  if (!county) throw new Error("San José source archive is incomplete");
  const fresh: ResearchSource[] = [];
  for (const source of prior)
    fresh.push(
      await fetchSource(source.id, source.url, source.publisher, source.format),
    );
  const source = fresh.find((s) => s.url === county.url)!;
  const writeInSource = writeIns
    ? fresh.find((s) => s.url === writeIns.url)
    : undefined;
  if (writeIns && writeInSource?.contentHash !== writeIns.contentHash)
    throw new Error(
      "Qualified write-in source changed; review scope and membership before renewal",
    );
  return appendReviewedSanJoseRoster(freshState, {
    source,
    writeInSource,
    proofSources: fresh.filter(
      (s) => s.url !== county.url && s.url !== writeIns?.url,
    ),
    crosswalk: current.localCrosswalk,
  });
}
