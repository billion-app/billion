import type { JobDefinition } from "./types.js";

/**
 * The jobs the supervisor knows how to run.
 *
 * These replace the hand-written runner scripts that lived in `~/.local/bin` on
 * big-mac. Each one names a script in the scraper's `dist/` and the arguments
 * it takes; the supervisor supplies serialisation, scheduling, backoff and
 * logging, so the job definitions stay declarative.
 */
export const jobs: readonly JobDefinition[] = [
  {
    id: "congress-daily",
    description: "Add and update the 100 most recently updated bills",
    script: "main.js",
    args: ["congress", "--recent", "100", "--concurrency", "4"],
    schedule: { kind: "daily", hour: 3, minute: 15 },
    // Most of the 100 will be unchanged and cost nothing beyond the fetch —
    // derived assets are keyed on content, so an unchanged bill regenerates
    // nothing. The budget bounds the days when that is not true, such as a bill
    // whose text was replaced by a substitute amendment.
    env: { SCRAPER_MAX_NEW_ITEMS_PER_RUN: "25" },
    priority: 0,
    idleTimeoutMinutes: 60,
    maxRuntimeHours: 24,
  },
  ...(["ca", "mo", "nc", "tx"] as const).map(
    (stateCode, index): JobDefinition => ({
      id: `open-states-${stateCode}-daily`,
      description: `Add and update the 100 most recently updated ${stateCode.toUpperCase()} measures`,
      script: "main.js",
      args: ["open-states", "--recent", "100", "--concurrency", "4"],
      schedule: { kind: "daily", hour: 3, minute: 30 },
      env: {
        OPEN_STATES_STATES: stateCode,
        SCRAPER_MAX_NEW_ITEMS_PER_RUN: "25",
      },
      priority: index + 1,
      idleTimeoutMinutes: 60,
      maxRuntimeHours: 24,
    }),
  ),
  // The other three registered scrapers. These used to ride along in a weekly
  // `main.js all` run; they are listed individually so that dropping the `all`
  // run does not silently stop them, and so each can be rescheduled or paused
  // without touching the others.
  //
  // They stay weekly because their sources move slowly compared with the
  // congressional feed.
  {
    id: "federalregister-weekly",
    description: "Executive orders and presidential documents",
    script: "main.js",
    args: ["federalregister", "--concurrency", "2"],
    schedule: { kind: "weekly", weekday: 0, hour: 3, minute: 15 },
    priority: 10,
    idleTimeoutMinutes: 60,
    maxRuntimeHours: 24,
  },
  {
    id: "scc-cvig-weekly",
    description: "Santa Clara County voter information guide",
    script: "main.js",
    args: ["scc-cvig", "--concurrency", "2"],
    schedule: { kind: "weekly", weekday: 0, hour: 3, minute: 15 },
    priority: 11,
    idleTimeoutMinutes: 60,
    maxRuntimeHours: 24,
  },
  {
    id: "ca-sos-weekly",
    description: "California Secretary of State candidate statements",
    script: "main.js",
    args: ["ca-sos-statements", "--concurrency", "2"],
    schedule: { kind: "weekly", weekday: 0, hour: 3, minute: 15 },
    priority: 12,
    idleTimeoutMinutes: 60,
    maxRuntimeHours: 24,
  },

  // Everything below is manual: it runs only when someone drops a request file,
  // never on a schedule.
  //
  // There is deliberately no scheduled archive backfill. The `scraper_cursor`
  // walk starts near the beginning of the congress, so an unattended job would
  // grind through ~17,000 measures paying for a brief, a dual-lens research
  // loop and header art on each one it enriched. The daily job above keeps
  // *active* legislation current, which is what a news feed needs.
  //
  // The retro jobs are manual for the same reason: each is bounded by how much
  // unenriched content exists, which is currently most of the archive. Filling
  // that in is a deliberate, supervised spend, not something a scheduler starts
  // on its own at 3am.
  {
    id: "backfill-descriptions",
    description: "Fill in the card gist for bills stored without one",
    script: "backfill-bill-descriptions.js",
    // Prefers a real congress.gov summary if one has been published since the
    // bill was stored, and only falls back to generating one — so most of this
    // is fetching, not inference, and it is the cheapest of the backfills.
    //
    // Exists for rows written before a bill had to be complete to be stored at
    // all. Nothing produces description-less bills any more; this drains the
    // ones that already exist.
    args: ["--concurrency", "4", "--apply", "--yes"],
    schedule: { kind: "manual" },
    // Ahead of the other backfills: a blank gist is the most visible defect of
    // the three, and the cheapest to repair.
    priority: 19,
    idleTimeoutMinutes: 60,
    maxRuntimeHours: 24,
  },
  {
    id: "retro-briefs",
    description: "Generate structured briefs for content missing one",
    script: "retroactive-briefs.js",
    // The limit is a ceiling on candidates, not a target: the script selects
    // only bills whose brief is missing or stale, so a generous number costs
    // nothing once the backlog is drained. It was 200 against a backlog of 794,
    // which meant four manual triggers to finish one job — and no record of how
    // many passes were left.
    args: ["--limit", "1000", "--concurrency", "4"],
    schedule: { kind: "manual" },
    priority: 20,
    idleTimeoutMinutes: 60,
    maxRuntimeHours: 72,
  },
  {
    id: "retro-lenses",
    description: "Generate dual-lens perspectives for content missing one",
    script: "retroactive-lenses.js",
    // The limit is a ceiling on candidates, not a target: the script selects
    // only content whose lens is missing or stale, so a generous number costs
    // nothing once the backlog is drained. It was 200 against a backlog of 731
    // (625 bills, 81 government items, 25 court cases), which meant four
    // triggers to finish one job and no record of how many passes were left —
    // the same trap 6a0d8ed fixed for retro-briefs.
    args: ["--type", "all", "--limit", "1000", "--concurrency", "4"],
    schedule: { kind: "manual" },
    priority: 21,
    idleTimeoutMinutes: 60,
    maxRuntimeHours: 72,
  },
  {
    id: "retro-videos",
    description: "Generate missing header art",
    script: "retroactive-videos.js",
    args: ["--type", "bill"],
    schedule: { kind: "manual" },
    priority: 30,
    idleTimeoutMinutes: 60,
    maxRuntimeHours: 48,
  },
  {
    id: "change-images",
    description: "Generate photographs for brief changes that warrant one",
    script: "change-images.js",
    // Bounded by the brief backlog rather than the archive: it only considers
    // changes inside briefs that already exist. Generation is local FLUX only,
    // so a long run costs GPU time and no money. ~35s per image at 1024x576,
    // and most changes are correctly decided to need no image at all.
    args: ["--limit", "2000", "--concurrency", "1"],
    schedule: { kind: "manual" },
    priority: 32,
    // A single image can take a minute on a cold pipeline; the default idle
    // timeout would kill a healthy run between two slow generations.
    idleTimeoutMinutes: 120,
    maxRuntimeHours: 72,
  },
  {
    id: "reprocess-bare",
    description: "Fill in bills left without an article or header art",
    script: "reprocess-content.js",
    // `--mode missing` selects only rows whose derived assets are actually
    // incomplete, so a run costs nothing once there is nothing left to fix.
    // Deliberately no `--limit`: the selection is already the bound, and a
    // limit would silently leave a remainder that nothing tracks.
    //
    // `--apply` and `--yes` are required for it to write at all; without them
    // the command is read-only, which would make this job a slow no-op.
    args: [
      "--type",
      "bill",
      "--mode",
      "missing",
      "--concurrency",
      "3",
      "--apply",
      "--yes",
    ],
    // Manual, and it should stay manual. Unlike the retro jobs this one can
    // rewrite assets across the whole archive if the selection policy widens,
    // so it wants a human deciding when it runs.
    schedule: { kind: "manual" },
    priority: 31,
    idleTimeoutMinutes: 60,
    maxRuntimeHours: 72,
  },
];

export function findJob(jobId: string): JobDefinition | undefined {
  return jobs.find((job) => job.id === jobId);
}
