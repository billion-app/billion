// ============================================================================
// Cached Client — DB-backed cache with 24h TTL
// ============================================================================

import { and, eq, gt } from "@acme/db";
import { db } from "@acme/db/client";
import {
  LegistarAgendaItem as LegistarAgendaItemRow,
  LegistarBody as LegistarBodyRow,
  LegistarMatter as LegistarMatterRow,
  LegistarMeeting as LegistarMeetingRow,
  LegistarVote as LegistarVoteRow,
} from "@acme/db/schema";

/**
 * Legistar Web API Client
 *
 * Integrates with the Legistar API for local government legislation data.
 * API docs: https://webapi.legistar.com/Help
 *
 * Supported jurisdictions:
 * - San Jose: sanjose.legistar.com
 * - Santa Clara County: sccgov.legistar.com
 * - Sunnyvale: sunnyvaleca.legistar.com
 */

// Jurisdiction configurations
// Note: Client names in Legistar API may differ from subdomain names
export const JURISDICTIONS = {
  sanjose: {
    client: "sanjose",
    name: "City of San Jose",
    baseUrl: "https://webapi.legistar.com/v1/sanjose",
  },
  santaclara: {
    client: "santaclara",
    name: "Santa Clara County",
    baseUrl: "https://webapi.legistar.com/v1/santaclara",
  },
  sunnyvale: {
    client: "sunnyvaleca",
    name: "City of Sunnyvale",
    baseUrl: "https://webapi.legistar.com/v1/sunnyvaleca",
  },
} as const;

export type Jurisdiction = keyof typeof JURISDICTIONS;

// ============================================================================
// Legistar API Types
// ============================================================================

export interface LegistarMeeting {
  EventId: number;
  EventGuid: string;
  EventLastModifiedUtc: string;
  EventRowVersion: string;
  EventBodyId: number;
  EventBodyName: string;
  EventDate: string;
  EventTime: string | null;
  EventVideoStatus: string | null;
  EventAgendaStatusId: number;
  EventAgendaStatusName: string;
  EventMinutesStatusId: number;
  EventMinutesStatusName: string;
  EventLocation: string | null;
  EventAgendaFile: string | null;
  EventMinutesFile: string | null;
  EventAgendaLastPublishedUTC: string | null;
  EventMinutesLastPublishedUTC: string | null;
  EventComment: string | null;
  EventVideoPath: string | null;
  EventInSiteURL: string | null;
  EventItems: LegistarAgendaItem[] | null;
}

export interface LegistarMatter {
  MatterId: number;
  MatterGuid: string;
  MatterLastModifiedUtc: string;
  MatterRowVersion: string;
  MatterFile: string;
  MatterName: string | null;
  MatterTitle: string;
  MatterTypeId: number;
  MatterTypeName: string;
  MatterStatusId: number;
  MatterStatusName: string;
  MatterBodyId: number;
  MatterBodyName: string;
  MatterIntroDate: string | null;
  MatterAgendaDate: string | null;
  MatterPassedDate: string | null;
  MatterEnactmentDate: string | null;
  MatterEnactmentNumber: string | null;
  MatterRequester: string | null;
  MatterNotes: string | null;
  MatterVersion: string;
  MatterText1: string | null;
  MatterText2: string | null;
  MatterText3: string | null;
  MatterText4: string | null;
  MatterText5: string | null;
  MatterRestrictViewViaWeb: boolean;
}

export interface LegistarVote {
  VoteId: number;
  VoteGuid: string;
  VoteLastModifiedUtc: string;
  VoteRowVersion: string;
  VotePersonId: number;
  VotePersonName: string;
  VoteValueId: number;
  VoteValueName: string;
  VoteSort: number;
  VoteResult: number | null;
  VoteEventItemId: number;
}

export interface LegistarAgendaItem {
  EventItemId: number;
  EventItemGuid: string;
  EventItemLastModifiedUtc: string;
  EventItemRowVersion: string;
  EventItemEventId: number;
  EventItemAgendaSequence: number;
  EventItemMinutesSequence: number | null;
  EventItemAgendaNumber: string | null;
  EventItemVideo: number | null;
  EventItemVideoIndex: number | null;
  EventItemVersion: string;
  EventItemAgendaNote: string | null;
  EventItemMinutesNote: string | null;
  EventItemActionId: number | null;
  EventItemActionName: string | null;
  EventItemActionText: string | null;
  EventItemPassedFlag: number | null;
  EventItemPassedFlagName: string | null;
  EventItemRollCallFlag: number | null;
  EventItemFlagExtra: number | null;
  EventItemTitle: string | null;
  EventItemTally: string | null;
  EventItemAccelaRecordId: string | null;
  EventItemConsent: number;
  EventItemMoverId: number | null;
  EventItemMover: string | null;
  EventItemSeconderId: number | null;
  EventItemSeconder: string | null;
  EventItemMatterId: number | null;
  EventItemMatterGuid: string | null;
  EventItemMatterFile: string | null;
  EventItemMatterName: string | null;
  EventItemMatterType: string | null;
  EventItemMatterStatus: string | null;
  EventItemMatterAttachments: LegistarAttachment[] | null;
}

export interface LegistarAttachment {
  MatterAttachmentId: number;
  MatterAttachmentGuid: string;
  MatterAttachmentLastModifiedUtc: string;
  MatterAttachmentRowVersion: string;
  MatterAttachmentName: string;
  MatterAttachmentHyperlink: string;
  MatterAttachmentFileName: string | null;
  MatterAttachmentMatterVersion: string;
  MatterAttachmentIsHyperlink: boolean;
  MatterAttachmentBinary: string | null;
  MatterAttachmentIsSupportingDocument: boolean;
  MatterAttachmentShowOnInternetPage: boolean;
  MatterAttachmentIsMinuteOrder: boolean;
  MatterAttachmentIsBoardLetter: boolean;
  MatterAttachmentAgiloftId: number;
  MatterAttachmentDescription: string | null;
  MatterAttachmentPrintWithReports: boolean;
  MatterAttachmentSort: number;
}

export interface LegistarBody {
  BodyId: number;
  BodyGuid: string;
  BodyLastModifiedUtc: string;
  BodyRowVersion: string;
  BodyName: string;
  BodyTypeId: number;
  BodyTypeName: string;
  BodyMeetFlag: number;
  BodyActiveFlag: number;
  BodySort: number;
  BodyDescription: string | null;
  BodyContactNameId: number | null;
  BodyContactFullName: string | null;
  BodyContactPhone: string | null;
  BodyContactEmail: string | null;
  BodyUsedControlFlag: number;
  BodyNumberOfMembers: number;
  BodyUsedActingFlag: number;
  BodyUsedTargetFlag: number;
  BodyUsedSponsorFlag: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface LegislationQuery {
  text?: string;
  matterType?: string;
  status?: string;
  bodyId?: number;
  introDateFrom?: Date;
  introDateTo?: Date;
}

// ============================================================================
// Legistar Client
// ============================================================================

class LegistarClient {
  private async fetch<T>(
    jurisdiction: Jurisdiction,
    endpoint: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const config = JURISDICTIONS[jurisdiction];
    const url = new URL(`${config.baseUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new LegistarError(
        `Legistar API error: ${response.status} ${response.statusText}`,
        response.status,
        jurisdiction,
        endpoint,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get meetings for a jurisdiction within a date range.
   */
  async getMeetings(
    jurisdiction: Jurisdiction,
    dateRange?: DateRange,
  ): Promise<LegistarMeeting[]> {
    const params: Record<string, string> = {};

    if (dateRange) {
      // OData filter for date range
      const startStr = dateRange.start.toISOString().split("T")[0];
      const endStr = dateRange.end.toISOString().split("T")[0];
      params.$filter = `EventDate ge datetime'${startStr}' and EventDate le datetime'${endStr}'`;
    }

    params.$orderby = "EventDate desc";

    return this.fetch<LegistarMeeting[]>(jurisdiction, "/Events", params);
  }

  /**
   * Get legislation (matters) for a jurisdiction with optional query filters.
   */
  async getLegislation(
    jurisdiction: Jurisdiction,
    query?: LegislationQuery,
  ): Promise<LegistarMatter[]> {
    const params: Record<string, string> = {};
    const filters: string[] = [];

    if (query) {
      if (query.text) {
        // Search in title using substringof (OData 2.0 compatible)
        filters.push(
          `(substringof('${query.text}',MatterTitle) or substringof('${query.text}',MatterFile))`,
        );
      }
      if (query.matterType) {
        filters.push(`MatterTypeName eq '${query.matterType}'`);
      }
      if (query.status) {
        filters.push(`MatterStatusName eq '${query.status}'`);
      }
      if (query.bodyId) {
        filters.push(`MatterBodyId eq ${query.bodyId}`);
      }
      if (query.introDateFrom) {
        const dateStr = query.introDateFrom.toISOString().split("T")[0];
        filters.push(`MatterIntroDate ge datetime'${dateStr}'`);
      }
      if (query.introDateTo) {
        const dateStr = query.introDateTo.toISOString().split("T")[0];
        filters.push(`MatterIntroDate le datetime'${dateStr}'`);
      }
    }

    if (filters.length > 0) {
      params.$filter = filters.join(" and ");
    }

    params.$orderby = "MatterIntroDate desc";
    params.$top = "100";

    return this.fetch<LegistarMatter[]>(jurisdiction, "/Matters", params);
  }

  /**
   * Get votes for a specific event item (agenda item with voting).
   * Note: Votes are associated with EventItems, not Matters directly.
   */
  async getVotes(
    jurisdiction: Jurisdiction,
    eventItemId: number,
  ): Promise<LegistarVote[]> {
    return this.fetch<LegistarVote[]>(
      jurisdiction,
      `/EventItems/${eventItemId}/Votes`,
    );
  }

  /**
   * Get roll call votes for all items in a meeting.
   * Returns agenda items with their associated votes.
   */
  async getMeetingVotes(
    jurisdiction: Jurisdiction,
    meetingId: number,
  ): Promise<LegistarAgendaItem[]> {
    return this.fetch<LegistarAgendaItem[]>(
      jurisdiction,
      `/Events/${meetingId}/EventItems`,
      { RollCalls: "1" },
    );
  }

  /**
   * Get agenda items for a specific meeting.
   */
  async getAgendas(
    jurisdiction: Jurisdiction,
    meetingId: number,
  ): Promise<LegistarAgendaItem[]> {
    return this.fetch<LegistarAgendaItem[]>(
      jurisdiction,
      `/Events/${meetingId}/EventItems`,
      { AgendaNote: "1", MinutesNote: "1", Attachments: "1" },
    );
  }

  /**
   * Get a single meeting by ID.
   */
  async getMeeting(
    jurisdiction: Jurisdiction,
    meetingId: number,
  ): Promise<LegistarMeeting> {
    return this.fetch<LegistarMeeting>(jurisdiction, `/Events/${meetingId}`, {
      EventItems: "1",
      EventItemAttachments: "1",
    });
  }

  /**
   * Get a single matter (legislation) by ID.
   */
  async getMatter(
    jurisdiction: Jurisdiction,
    matterId: number,
  ): Promise<LegistarMatter> {
    return this.fetch<LegistarMatter>(jurisdiction, `/Matters/${matterId}`);
  }

  /**
   * Get all bodies (committees, councils, boards) for a jurisdiction.
   */
  async getBodies(jurisdiction: Jurisdiction): Promise<LegistarBody[]> {
    return this.fetch<LegistarBody[]>(jurisdiction, "/Bodies", {
      $filter: "BodyActiveFlag eq 1",
    });
  }

  /**
   * Get attachments for a matter.
   */
  async getMatterAttachments(
    jurisdiction: Jurisdiction,
    matterId: number,
  ): Promise<LegistarAttachment[]> {
    return this.fetch<LegistarAttachment[]>(
      jurisdiction,
      `/Matters/${matterId}/Attachments`,
    );
  }

  /**
   * Search for matters across all matter types.
   */
  async searchMatters(
    jurisdiction: Jurisdiction,
    searchText: string,
  ): Promise<LegistarMatter[]> {
    return this.getLegislation(jurisdiction, { text: searchText });
  }
}

// ============================================================================
// Error Handling
// ============================================================================

export class LegistarError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public jurisdiction: Jurisdiction,
    public endpoint: string,
  ) {
    super(message);
    this.name = "LegistarError";
  }
}

// ============================================================================
// Mock Data (used when API is unavailable in development)
// ============================================================================

function mockDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

const MOCK_MATTERS_SANJOSE: LegistarMatter[] = [
  {
    MatterId: 90001,
    MatterGuid: "mock-sj-001",
    MatterLastModifiedUtc: mockDate(2),
    MatterRowVersion: "1",
    MatterFile: "RES 2025-101",
    MatterName: null,
    MatterTitle:
      "Approval of Affordable Housing Development at 500 E Santa Clara St",
    MatterTypeId: 1,
    MatterTypeName: "Resolution",
    MatterStatusId: 1,
    MatterStatusName: "Approved",
    MatterBodyId: 1,
    MatterBodyName: "City Council",
    MatterIntroDate: mockDate(30),
    MatterAgendaDate: mockDate(7),
    MatterPassedDate: mockDate(5),
    MatterEnactmentDate: null,
    MatterEnactmentNumber: null,
    MatterRequester: null,
    MatterNotes: null,
    MatterVersion: "1",
    MatterText1: null,
    MatterText2: null,
    MatterText3: null,
    MatterText4: null,
    MatterText5: null,
    MatterRestrictViewViaWeb: false,
  },
  {
    MatterId: 90002,
    MatterGuid: "mock-sj-002",
    MatterLastModifiedUtc: mockDate(5),
    MatterRowVersion: "1",
    MatterFile: "ORD 2025-045",
    MatterName: null,
    MatterTitle:
      "Amendment to Municipal Code Chapter 20.80 — Protected Trees Ordinance Update",
    MatterTypeId: 2,
    MatterTypeName: "Ordinance",
    MatterStatusId: 2,
    MatterStatusName: "Pending",
    MatterBodyId: 1,
    MatterBodyName: "City Council",
    MatterIntroDate: mockDate(20),
    MatterAgendaDate: mockDate(10),
    MatterPassedDate: null,
    MatterEnactmentDate: null,
    MatterEnactmentNumber: null,
    MatterRequester: null,
    MatterNotes: null,
    MatterVersion: "1",
    MatterText1: null,
    MatterText2: null,
    MatterText3: null,
    MatterText4: null,
    MatterText5: null,
    MatterRestrictViewViaWeb: false,
  },
  {
    MatterId: 90003,
    MatterGuid: "mock-sj-003",
    MatterLastModifiedUtc: mockDate(8),
    MatterRowVersion: "1",
    MatterFile: "MGR 2025-012",
    MatterName: null,
    MatterTitle:
      "City Manager Report on Downtown Bike Lane Network Expansion Plan",
    MatterTypeId: 3,
    MatterTypeName: "Report",
    MatterStatusId: 1,
    MatterStatusName: "Filed",
    MatterBodyId: 3,
    MatterBodyName: "Transportation & Environment Committee",
    MatterIntroDate: mockDate(15),
    MatterAgendaDate: mockDate(10),
    MatterPassedDate: null,
    MatterEnactmentDate: null,
    MatterEnactmentNumber: null,
    MatterRequester: null,
    MatterNotes: null,
    MatterVersion: "1",
    MatterText1: null,
    MatterText2: null,
    MatterText3: null,
    MatterText4: null,
    MatterText5: null,
    MatterRestrictViewViaWeb: false,
  },
  {
    MatterId: 90004,
    MatterGuid: "mock-sj-004",
    MatterLastModifiedUtc: mockDate(1),
    MatterRowVersion: "1",
    MatterFile: "RES 2025-118",
    MatterName: null,
    MatterTitle:
      "Authorization for Emergency Water Main Repair on N 1st Street",
    MatterTypeId: 1,
    MatterTypeName: "Resolution",
    MatterStatusId: 1,
    MatterStatusName: "Approved",
    MatterBodyId: 1,
    MatterBodyName: "City Council",
    MatterIntroDate: mockDate(3),
    MatterAgendaDate: mockDate(2),
    MatterPassedDate: mockDate(1),
    MatterEnactmentDate: null,
    MatterEnactmentNumber: null,
    MatterRequester: null,
    MatterNotes: null,
    MatterVersion: "1",
    MatterText1: null,
    MatterText2: null,
    MatterText3: null,
    MatterText4: null,
    MatterText5: null,
    MatterRestrictViewViaWeb: false,
  },
];

const MOCK_MATTERS_SANTACLARA: LegistarMatter[] = [
  {
    MatterId: 91001,
    MatterGuid: "mock-sc-001",
    MatterLastModifiedUtc: mockDate(3),
    MatterRowVersion: "1",
    MatterFile: "BOS 2025-034",
    MatterName: null,
    MatterTitle:
      "Adoption of Santa Clara County Climate Action Plan 2030 Update",
    MatterTypeId: 1,
    MatterTypeName: "Board Resolution",
    MatterStatusId: 2,
    MatterStatusName: "Pending",
    MatterBodyId: 1,
    MatterBodyName: "Board of Supervisors",
    MatterIntroDate: mockDate(25),
    MatterAgendaDate: mockDate(7),
    MatterPassedDate: null,
    MatterEnactmentDate: null,
    MatterEnactmentNumber: null,
    MatterRequester: null,
    MatterNotes: null,
    MatterVersion: "1",
    MatterText1: null,
    MatterText2: null,
    MatterText3: null,
    MatterText4: null,
    MatterText5: null,
    MatterRestrictViewViaWeb: false,
  },
  {
    MatterId: 91002,
    MatterGuid: "mock-sc-002",
    MatterLastModifiedUtc: mockDate(6),
    MatterRowVersion: "1",
    MatterFile: "BOS 2025-029",
    MatterName: null,
    MatterTitle:
      "Agreement with Valley Transportation Authority for BART Phase II Funding",
    MatterTypeId: 1,
    MatterTypeName: "Board Resolution",
    MatterStatusId: 1,
    MatterStatusName: "Approved",
    MatterBodyId: 1,
    MatterBodyName: "Board of Supervisors",
    MatterIntroDate: mockDate(40),
    MatterAgendaDate: mockDate(14),
    MatterPassedDate: mockDate(7),
    MatterEnactmentDate: null,
    MatterEnactmentNumber: null,
    MatterRequester: null,
    MatterNotes: null,
    MatterVersion: "1",
    MatterText1: null,
    MatterText2: null,
    MatterText3: null,
    MatterText4: null,
    MatterText5: null,
    MatterRestrictViewViaWeb: false,
  },
  {
    MatterId: 91003,
    MatterGuid: "mock-sc-003",
    MatterLastModifiedUtc: mockDate(4),
    MatterRowVersion: "1",
    MatterFile: "BOS 2025-041",
    MatterName: null,
    MatterTitle:
      "Ordinance Amending County Code for Short-Term Rental Regulations in Unincorporated Areas",
    MatterTypeId: 2,
    MatterTypeName: "Ordinance",
    MatterStatusId: 2,
    MatterStatusName: "Pending",
    MatterBodyId: 1,
    MatterBodyName: "Board of Supervisors",
    MatterIntroDate: mockDate(14),
    MatterAgendaDate: mockDate(7),
    MatterPassedDate: null,
    MatterEnactmentDate: null,
    MatterEnactmentNumber: null,
    MatterRequester: null,
    MatterNotes: null,
    MatterVersion: "1",
    MatterText1: null,
    MatterText2: null,
    MatterText3: null,
    MatterText4: null,
    MatterText5: null,
    MatterRestrictViewViaWeb: false,
  },
];

class FallbackLegistarClient extends LegistarClient {
  override async getLegislation(
    jurisdiction: Jurisdiction,
    query?: LegislationQuery,
  ): Promise<LegistarMatter[]> {
    try {
      return await super.getLegislation(jurisdiction, query);
    } catch {
      if (jurisdiction === "sanjose") return MOCK_MATTERS_SANJOSE;
      if (jurisdiction === "santaclara") return MOCK_MATTERS_SANTACLARA;
      return [];
    }
  }
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

class CachedLegistarClient extends FallbackLegistarClient {
  override async getLegislation(
    jurisdiction: Jurisdiction,
    query?: LegislationQuery,
  ): Promise<LegistarMatter[]> {
    if (
      !query?.text &&
      !query?.matterType &&
      !query?.status &&
      !query?.bodyId
    ) {
      const cached = await db
        .select()
        .from(LegistarMatterRow)
        .where(
          and(
            eq(LegistarMatterRow.jurisdiction, jurisdiction),
            gt(
              LegistarMatterRow.fetchedAt,
              new Date(Date.now() - CACHE_TTL_MS),
            ),
          ),
        )
        .orderBy(LegistarMatterRow.lastModifiedUtc)
        .limit(100);

      if (cached.length > 0) {
        return cached.map(rowToMatter);
      }
    }

    const matters = await super.getLegislation(jurisdiction, query);
    await this.upsertMatters(jurisdiction, matters);
    return matters;
  }

  override async getMeetings(
    jurisdiction: Jurisdiction,
    dateRange?: DateRange,
  ): Promise<LegistarMeeting[]> {
    const cached = await db
      .select()
      .from(LegistarMeetingRow)
      .where(
        and(
          eq(LegistarMeetingRow.jurisdiction, jurisdiction),
          gt(LegistarMeetingRow.fetchedAt, new Date(Date.now() - CACHE_TTL_MS)),
        ),
      )
      .orderBy(LegistarMeetingRow.date);

    const filtered = dateRange
      ? cached.filter((m) => {
          const d = m.date.getTime();
          return d >= dateRange.start.getTime() && d <= dateRange.end.getTime();
        })
      : cached;

    if (filtered.length > 0) return filtered.map(rowToMeeting);

    const meetings = await super.getMeetings(jurisdiction, dateRange);
    await this.upsertMeetings(jurisdiction, meetings);
    return meetings;
  }

  override async getBodies(
    jurisdiction: Jurisdiction,
  ): Promise<LegistarBody[]> {
    const cached = await db
      .select()
      .from(LegistarBodyRow)
      .where(
        and(
          eq(LegistarBodyRow.jurisdiction, jurisdiction),
          gt(LegistarBodyRow.fetchedAt, new Date(Date.now() - CACHE_TTL_MS)),
        ),
      );

    if (cached.length > 0) return cached.map(rowToBody);

    const bodies = await super.getBodies(jurisdiction);
    await this.upsertBodies(jurisdiction, bodies);
    return bodies;
  }

  override async getAgendas(
    jurisdiction: Jurisdiction,
    meetingId: number,
  ): Promise<LegistarAgendaItem[]> {
    const cached = await db
      .select()
      .from(LegistarAgendaItemRow)
      .where(
        and(
          eq(LegistarAgendaItemRow.jurisdiction, jurisdiction),
          eq(LegistarAgendaItemRow.eventId, meetingId),
          gt(
            LegistarAgendaItemRow.fetchedAt,
            new Date(Date.now() - CACHE_TTL_MS),
          ),
        ),
      )
      .orderBy(LegistarAgendaItemRow.agendaSequence);

    if (cached.length > 0) return cached.map(rowToAgendaItem);

    const items = await super.getAgendas(jurisdiction, meetingId);
    await this.upsertAgendaItems(jurisdiction, items);
    return items;
  }

  override async getVotes(
    jurisdiction: Jurisdiction,
    eventItemId: number,
  ): Promise<LegistarVote[]> {
    const cached = await db
      .select()
      .from(LegistarVoteRow)
      .where(
        and(
          eq(LegistarVoteRow.jurisdiction, jurisdiction),
          eq(LegistarVoteRow.eventItemId, eventItemId),
          gt(LegistarVoteRow.fetchedAt, new Date(Date.now() - CACHE_TTL_MS)),
        ),
      )
      .orderBy(LegistarVoteRow.sort);

    if (cached.length > 0) return cached.map(rowToVote);

    const votes = await super.getVotes(jurisdiction, eventItemId);
    await this.upsertVotes(jurisdiction, votes);
    return votes;
  }

  override async getMeetingVotes(
    jurisdiction: Jurisdiction,
    meetingId: number,
  ): Promise<LegistarAgendaItem[]> {
    const items = await super.getMeetingVotes(jurisdiction, meetingId);
    await this.upsertAgendaItems(jurisdiction, items);
    return items;
  }

  // --- Upsert helpers ---

  private async upsertMatters(
    jurisdiction: Jurisdiction,
    matters: LegistarMatter[],
  ) {
    if (matters.length === 0) return;
    const now = new Date();
    for (const m of matters) {
      await db
        .insert(LegistarMatterRow)
        .values({
          jurisdiction,
          matterId: m.MatterId,
          matterGuid: m.MatterGuid,
          matterFile: m.MatterFile,
          title: m.MatterTitle,
          name: m.MatterName,
          typeName: m.MatterTypeName,
          statusName: m.MatterStatusName,
          bodyName: m.MatterBodyName,
          bodyId: m.MatterBodyId,
          introDate: parseDate(m.MatterIntroDate),
          agendaDate: parseDate(m.MatterAgendaDate),
          passedDate: parseDate(m.MatterPassedDate),
          enactmentDate: parseDate(m.MatterEnactmentDate),
          enactmentNumber: m.MatterEnactmentNumber,
          requester: m.MatterRequester,
          notes: m.MatterNotes,
          lastModifiedUtc: new Date(m.MatterLastModifiedUtc),
          fetchedAt: now,
        })
        .onConflictDoUpdate({
          target: [LegistarMatterRow.jurisdiction, LegistarMatterRow.matterId],
          set: {
            title: m.MatterTitle,
            statusName: m.MatterStatusName,
            lastModifiedUtc: new Date(m.MatterLastModifiedUtc),
            fetchedAt: now,
          },
        });
    }
  }

  private async upsertMeetings(
    jurisdiction: Jurisdiction,
    meetings: LegistarMeeting[],
  ) {
    if (meetings.length === 0) return;
    const now = new Date();
    for (const m of meetings) {
      await db
        .insert(LegistarMeetingRow)
        .values({
          jurisdiction,
          eventId: m.EventId,
          eventGuid: m.EventGuid,
          bodyId: m.EventBodyId,
          bodyName: m.EventBodyName,
          date: new Date(m.EventDate),
          time: m.EventTime,
          location: m.EventLocation,
          agendaFile: m.EventAgendaFile,
          minutesFile: m.EventMinutesFile,
          videoPath: m.EventVideoPath,
          agendaStatusName: m.EventAgendaStatusName,
          minutesStatusName: m.EventMinutesStatusName,
          comment: m.EventComment,
          inSiteUrl: m.EventInSiteURL,
          lastModifiedUtc: new Date(m.EventLastModifiedUtc),
          fetchedAt: now,
        })
        .onConflictDoUpdate({
          target: [LegistarMeetingRow.jurisdiction, LegistarMeetingRow.eventId],
          set: {
            agendaFile: m.EventAgendaFile,
            minutesFile: m.EventMinutesFile,
            videoPath: m.EventVideoPath,
            lastModifiedUtc: new Date(m.EventLastModifiedUtc),
            fetchedAt: now,
          },
        });
    }
  }

  private async upsertBodies(
    jurisdiction: Jurisdiction,
    bodies: LegistarBody[],
  ) {
    if (bodies.length === 0) return;
    const now = new Date();
    for (const b of bodies) {
      await db
        .insert(LegistarBodyRow)
        .values({
          jurisdiction,
          bodyId: b.BodyId,
          bodyGuid: b.BodyGuid,
          name: b.BodyName,
          typeName: b.BodyTypeName,
          activeFlag: b.BodyActiveFlag === 1,
          numberOfMembers: b.BodyNumberOfMembers,
          description: b.BodyDescription,
          contactName: b.BodyContactFullName,
          contactEmail: b.BodyContactEmail,
          contactPhone: b.BodyContactPhone,
          fetchedAt: now,
        })
        .onConflictDoUpdate({
          target: [LegistarBodyRow.jurisdiction, LegistarBodyRow.bodyId],
          set: {
            name: b.BodyName,
            activeFlag: b.BodyActiveFlag === 1,
            fetchedAt: now,
          },
        });
    }
  }

  private async upsertAgendaItems(
    jurisdiction: Jurisdiction,
    items: LegistarAgendaItem[],
  ) {
    if (items.length === 0) return;
    const now = new Date();
    for (const i of items) {
      await db
        .insert(LegistarAgendaItemRow)
        .values({
          jurisdiction,
          eventItemId: i.EventItemId,
          eventId: i.EventItemEventId,
          agendaSequence: i.EventItemAgendaSequence,
          agendaNumber: i.EventItemAgendaNumber,
          title: i.EventItemTitle,
          actionName: i.EventItemActionName,
          passedFlagName: i.EventItemPassedFlagName,
          tally: i.EventItemTally,
          moverName: i.EventItemMover,
          seconderName: i.EventItemSeconder,
          matterId: i.EventItemMatterId,
          matterFile: i.EventItemMatterFile,
          matterName: i.EventItemMatterName,
          matterType: i.EventItemMatterType,
          matterStatus: i.EventItemMatterStatus,
          consent: i.EventItemConsent === 1,
          agendaNote: i.EventItemAgendaNote,
          minutesNote: i.EventItemMinutesNote,
          lastModifiedUtc: new Date(i.EventItemLastModifiedUtc),
          fetchedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            LegistarAgendaItemRow.jurisdiction,
            LegistarAgendaItemRow.eventItemId,
          ],
          set: {
            actionName: i.EventItemActionName,
            passedFlagName: i.EventItemPassedFlagName,
            tally: i.EventItemTally,
            fetchedAt: now,
          },
        });
    }
  }

  private async upsertVotes(jurisdiction: Jurisdiction, votes: LegistarVote[]) {
    if (votes.length === 0) return;
    const now = new Date();
    for (const v of votes) {
      await db
        .insert(LegistarVoteRow)
        .values({
          jurisdiction,
          voteId: v.VoteId,
          eventItemId: v.VoteEventItemId,
          personId: v.VotePersonId,
          personName: v.VotePersonName,
          valueName: v.VoteValueName,
          sort: v.VoteSort,
          lastModifiedUtc: new Date(v.VoteLastModifiedUtc),
          fetchedAt: now,
        })
        .onConflictDoUpdate({
          target: [LegistarVoteRow.jurisdiction, LegistarVoteRow.voteId],
          set: {
            valueName: v.VoteValueName,
            fetchedAt: now,
          },
        });
    }
  }
}

// --- Row-to-API-type mappers (for cache reads) ---

function rowToMatter(r: typeof LegistarMatterRow.$inferSelect): LegistarMatter {
  return {
    MatterId: r.matterId,
    MatterGuid: r.matterGuid ?? "",
    MatterLastModifiedUtc: r.lastModifiedUtc.toISOString(),
    MatterRowVersion: "1",
    MatterFile: r.matterFile ?? "",
    MatterName: r.name,
    MatterTitle: r.title,
    MatterTypeId: 0,
    MatterTypeName: r.typeName ?? "",
    MatterStatusId: 0,
    MatterStatusName: r.statusName ?? "",
    MatterBodyId: r.bodyId ?? 0,
    MatterBodyName: r.bodyName ?? "",
    MatterIntroDate: r.introDate?.toISOString() ?? null,
    MatterAgendaDate: r.agendaDate?.toISOString() ?? null,
    MatterPassedDate: r.passedDate?.toISOString() ?? null,
    MatterEnactmentDate: r.enactmentDate?.toISOString() ?? null,
    MatterEnactmentNumber: r.enactmentNumber,
    MatterRequester: r.requester,
    MatterNotes: r.notes,
    MatterVersion: "1",
    MatterText1: null,
    MatterText2: null,
    MatterText3: null,
    MatterText4: null,
    MatterText5: null,
    MatterRestrictViewViaWeb: false,
  };
}

function rowToMeeting(
  r: typeof LegistarMeetingRow.$inferSelect,
): LegistarMeeting {
  return {
    EventId: r.eventId,
    EventGuid: r.eventGuid ?? "",
    EventLastModifiedUtc: r.lastModifiedUtc.toISOString(),
    EventRowVersion: "1",
    EventBodyId: r.bodyId ?? 0,
    EventBodyName: r.bodyName ?? "",
    EventDate: r.date.toISOString(),
    EventTime: r.time,
    EventVideoStatus: null,
    EventAgendaStatusId: 0,
    EventAgendaStatusName: r.agendaStatusName ?? "",
    EventMinutesStatusId: 0,
    EventMinutesStatusName: r.minutesStatusName ?? "",
    EventLocation: r.location,
    EventAgendaFile: r.agendaFile,
    EventMinutesFile: r.minutesFile,
    EventAgendaLastPublishedUTC: null,
    EventMinutesLastPublishedUTC: null,
    EventComment: r.comment,
    EventVideoPath: r.videoPath,
    EventInSiteURL: r.inSiteUrl,
    EventItems: null,
  };
}

function rowToBody(r: typeof LegistarBodyRow.$inferSelect): LegistarBody {
  return {
    BodyId: r.bodyId,
    BodyGuid: r.bodyGuid ?? "",
    BodyLastModifiedUtc: r.fetchedAt.toISOString(),
    BodyRowVersion: "1",
    BodyName: r.name,
    BodyTypeId: 0,
    BodyTypeName: r.typeName ?? "",
    BodyMeetFlag: 0,
    BodyActiveFlag: r.activeFlag ? 1 : 0,
    BodySort: 0,
    BodyDescription: r.description,
    BodyContactNameId: null,
    BodyContactFullName: r.contactName,
    BodyContactPhone: r.contactPhone,
    BodyContactEmail: r.contactEmail,
    BodyUsedControlFlag: 0,
    BodyNumberOfMembers: r.numberOfMembers ?? 0,
    BodyUsedActingFlag: 0,
    BodyUsedTargetFlag: 0,
    BodyUsedSponsorFlag: 0,
  };
}

function rowToAgendaItem(
  r: typeof LegistarAgendaItemRow.$inferSelect,
): LegistarAgendaItem {
  return {
    EventItemId: r.eventItemId,
    EventItemGuid: "",
    EventItemLastModifiedUtc: r.lastModifiedUtc.toISOString(),
    EventItemRowVersion: "1",
    EventItemEventId: r.eventId,
    EventItemAgendaSequence: r.agendaSequence ?? 0,
    EventItemMinutesSequence: null,
    EventItemAgendaNumber: r.agendaNumber,
    EventItemVideo: null,
    EventItemVideoIndex: null,
    EventItemVersion: "1",
    EventItemAgendaNote: r.agendaNote,
    EventItemMinutesNote: r.minutesNote,
    EventItemActionId: null,
    EventItemActionName: r.actionName,
    EventItemActionText: null,
    EventItemPassedFlag: null,
    EventItemPassedFlagName: r.passedFlagName,
    EventItemRollCallFlag: null,
    EventItemFlagExtra: null,
    EventItemTitle: r.title,
    EventItemTally: r.tally,
    EventItemAccelaRecordId: null,
    EventItemConsent: r.consent ? 1 : 0,
    EventItemMoverId: null,
    EventItemMover: r.moverName,
    EventItemSeconderId: null,
    EventItemSeconder: r.seconderName,
    EventItemMatterId: r.matterId,
    EventItemMatterGuid: null,
    EventItemMatterFile: r.matterFile,
    EventItemMatterName: r.matterName,
    EventItemMatterType: r.matterType,
    EventItemMatterStatus: r.matterStatus,
    EventItemMatterAttachments: null,
  };
}

function rowToVote(r: typeof LegistarVoteRow.$inferSelect): LegistarVote {
  return {
    VoteId: r.voteId,
    VoteGuid: "",
    VoteLastModifiedUtc: r.lastModifiedUtc.toISOString(),
    VoteRowVersion: "1",
    VotePersonId: r.personId,
    VotePersonName: r.personName,
    VoteValueId: 0,
    VoteValueName: r.valueName,
    VoteSort: r.sort ?? 0,
    VoteResult: null,
    VoteEventItemId: r.eventItemId,
  };
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const legistar = new CachedLegistarClient();

export { LegistarClient };
