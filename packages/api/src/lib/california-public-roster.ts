import { z } from "zod/v4";

import type { db } from "@acme/db/client";
import { eq, sql } from "@acme/db";
import { CaliforniaRoster } from "@acme/db/schema";
import {
  californiaRaceTargetSchema,
  californiaRosterSnapshotSchema,
} from "@acme/validators";

import { getCurrentCaliforniaRosterId } from "./california-roster-store";

const publicSourceProof = z.object({ url: z.url() }).nullish();
const publicMemberSchema = californiaRaceTargetSchema.shape.members.element
  .pick({
    identity: true,
    candidateId: true,
    name: true,
    party: true,
    ballotStatus: true,
  })
  .extend({ sourceProof: publicSourceProof });
const publicRaceSchema = californiaRaceTargetSchema
  .pick({
    raceKey: true,
    contestId: true,
    jurisdiction: true,
    jurisdictionLabel: true,
    electionDate: true,
    officeFamily: true,
    office: true,
    district: true,
    kind: true,
    rosterDigest: true,
  })
  .extend({
    rosterSourceUrl: z.url().nullish(),
    members: z.array(publicMemberSchema).min(1),
  });
export const publicCaliforniaRosterSchema = californiaRosterSnapshotSchema
  .pick({ id: true, electionDate: true, scope: true, scopeLabel: true })
  .extend({
    source: californiaRosterSnapshotSchema.shape.source.pick({
      url: true,
      byteHash: true,
      textHash: true,
      fetchedAt: true,
      encoding: true,
    }),
    races: z.array(publicRaceSchema).min(1),
    localCoverage:
      californiaRosterSnapshotSchema.shape.localCoverage.nullable(),
    countyCoverage: z.array(
      californiaRosterSnapshotSchema.shape.countyCoverage.element
        .pick({ fips: true, name: true, status: true })
        .extend({ sourceUrl: z.url().nullish() }),
    ),
  });
export type PublicCaliforniaRoster = z.infer<
  typeof publicCaliforniaRosterSchema
>;
type Reader = Pick<typeof db, "select">;
const projection = sql<unknown>`jsonb_build_object(
  'id',${CaliforniaRoster.document}->'id',
  'electionDate',${CaliforniaRoster.document}->'electionDate',
  'scope',${CaliforniaRoster.document}->'scope',
  'scopeLabel',${CaliforniaRoster.document}->'scopeLabel',
  'source',jsonb_build_object(
    'url',${CaliforniaRoster.document}->'source'->'url',
    'byteHash',${CaliforniaRoster.document}->'source'->'byteHash',
    'textHash',${CaliforniaRoster.document}->'source'->'textHash',
    'fetchedAt',${CaliforniaRoster.document}->'source'->'fetchedAt',
    'encoding',${CaliforniaRoster.document}->'source'->'encoding'
  ),
  'localCoverage',${CaliforniaRoster.document}->'localCoverage',
  'countyCoverage',coalesce((select jsonb_agg(jsonb_build_object(
    'fips',county->'fips','name',county->'name','status',county->'status','sourceUrl',county->'sourceUrl'
  )) from jsonb_array_elements(${CaliforniaRoster.document}->'countyCoverage') county),'[]'::jsonb),
  'races',coalesce((select jsonb_agg(jsonb_build_object(
    'raceKey',race->'raceKey','contestId',race->'contestId',
    'jurisdiction',race->'jurisdiction','jurisdictionLabel',race->'jurisdictionLabel',
    'electionDate',race->'electionDate','officeFamily',race->'officeFamily',
    'office',race->'office','district',race->'district','kind',race->'kind',
    'rosterDigest',race->'rosterDigest','rosterSourceUrl',race->'rosterSourceUrl',
    'members',coalesce((select jsonb_agg(jsonb_build_object(
      'identity',member->'identity','candidateId',member->'candidateId',
      'name',member->'name','party',member->'party','ballotStatus',member->'ballotStatus',
      'sourceProof',case when member->'sourceProof' is not null then jsonb_build_object('url',member->'sourceProof'->'url') else null end
    )) from jsonb_array_elements(race->'members') member),'[]'::jsonb)
  )) from jsonb_array_elements(${CaliforniaRoster.document}->'races') race),'[]'::jsonb)
)`;
export async function getPublicCaliforniaRosterMetadata(
  database: Reader,
  id: string,
) {
  const [row] = await database
    .select({
      id: CaliforniaRoster.id,
      fingerprint: sql<string>`md5(${projection}::text)`,
    })
    .from(CaliforniaRoster)
    .where(eq(CaliforniaRoster.id, id))
    .limit(1);
  return row ?? null;
}
export async function getPublicCaliforniaRoster(database: Reader, id: string) {
  const [row] = await database
    .select({ document: projection })
    .from(CaliforniaRoster)
    .where(eq(CaliforniaRoster.id, id))
    .limit(1);
  return row ? publicCaliforniaRosterSchema.parse(row.document) : null;
}
export async function getLatestPublicCaliforniaRoster(
  database: Reader,
  electionDate: string,
) {
  const id = await getCurrentCaliforniaRosterId(database, electionDate);
  return id ? getPublicCaliforniaRoster(database, id) : null;
}
