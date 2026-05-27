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
    return this.fetch<LegistarMeeting>(
      jurisdiction,
      `/Events/${meetingId}`,
      { EventItems: "1", EventItemAttachments: "1" },
    );
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
// Export singleton instance
// ============================================================================

export const legistar = new LegistarClient();

// Also export the class for testing
export { LegistarClient };
