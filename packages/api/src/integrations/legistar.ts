/**
 * Legistar Web API transport.
 *
 * This module intentionally contains no persistence or product policy. The
 * scraper owns ingestion and normalization; the API router reads the durable
 * local-government tables. Keeping the transport stateless prevents an app
 * request from becoming an accidental crawler run.
 */

export const JURISDICTIONS = {
  sanjose: {
    client: "sanjose",
    name: "City of San José",
    baseUrl: "https://webapi.legistar.com/v1/sanjose",
    publicPortalUrl: "https://sanjose.legistar.com",
    state: "CA",
    timezone: "America/Los_Angeles",
  },
  santaclara: {
    client: "santaclara",
    name: "Santa Clara County",
    baseUrl: "https://webapi.legistar.com/v1/santaclara",
    publicPortalUrl: "https://sccgov.legistar.com",
    state: "CA",
    timezone: "America/Los_Angeles",
  },
  sunnyvale: {
    client: "sunnyvaleca",
    name: "City of Sunnyvale",
    baseUrl: "https://webapi.legistar.com/v1/sunnyvaleca",
    publicPortalUrl: "https://sunnyvaleca.legistar.com",
    state: "CA",
    timezone: "America/Los_Angeles",
  },
} as const;

export type Jurisdiction = keyof typeof JURISDICTIONS;

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

export interface LegistarMatterHistory {
  MatterHistoryId: number;
  MatterHistoryGuid: string;
  MatterHistoryMatterId: number;
  MatterHistoryActionDate: string | null;
  MatterHistoryActionId: number | null;
  MatterHistoryActionName: string | null;
  MatterHistoryDescription: string | null;
  MatterHistoryBodyId: number | null;
  MatterHistoryBodyName: string | null;
  MatterHistoryEventId: number | null;
  MatterHistoryEventItemId: number | null;
  MatterHistoryAgendaNumber: string | null;
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

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function escapeOData(value: string): string {
  return value.replaceAll("'", "''");
}

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

export class LegistarClient {
  constructor(private readonly request: FetchLike = fetch) {}

  private async fetchJson<T>(
    jurisdiction: Jurisdiction,
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(`${JURISDICTIONS[jurisdiction].baseUrl}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await this.request(url, {
      headers: { Accept: "application/json" },
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

  private async fetchAll<T>(
    jurisdiction: Jurisdiction,
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await this.fetchJson<T[]>(jurisdiction, endpoint, {
        ...params,
        $top: String(PAGE_SIZE),
        $skip: String(page * PAGE_SIZE),
      });
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) return rows;
    }
    throw new LegistarError(
      `Legistar pagination exceeded ${MAX_PAGES * PAGE_SIZE} rows`,
      0,
      jurisdiction,
      endpoint,
    );
  }

  getMeetings(
    jurisdiction: Jurisdiction,
    dateRange?: DateRange,
  ): Promise<LegistarMeeting[]> {
    const params: Record<string, string> = { $orderby: "EventDate asc" };
    if (dateRange) {
      params.$filter = `EventDate ge datetime'${isoDate(dateRange.start)}' and EventDate le datetime'${isoDate(dateRange.end)}'`;
    }
    return this.fetchAll(jurisdiction, "/Events", params);
  }

  getLegislation(
    jurisdiction: Jurisdiction,
    query: LegislationQuery = {},
  ): Promise<LegistarMatter[]> {
    const filters: string[] = [];
    if (query.text) {
      const text = escapeOData(query.text);
      filters.push(
        `(substringof('${text}',MatterTitle) or substringof('${text}',MatterFile))`,
      );
    }
    if (query.matterType)
      filters.push(`MatterTypeName eq '${escapeOData(query.matterType)}'`);
    if (query.status)
      filters.push(`MatterStatusName eq '${escapeOData(query.status)}'`);
    if (query.bodyId) filters.push(`MatterBodyId eq ${query.bodyId}`);
    if (query.introDateFrom)
      filters.push(
        `MatterIntroDate ge datetime'${isoDate(query.introDateFrom)}'`,
      );
    if (query.introDateTo)
      filters.push(
        `MatterIntroDate le datetime'${isoDate(query.introDateTo)}'`,
      );
    return this.fetchAll(jurisdiction, "/Matters", {
      ...(filters.length ? { $filter: filters.join(" and ") } : {}),
      $orderby: "MatterIntroDate desc",
    });
  }

  getMeeting(
    jurisdiction: Jurisdiction,
    eventId: number,
  ): Promise<LegistarMeeting> {
    return this.fetchJson(jurisdiction, `/Events/${eventId}`);
  }

  getAgendaItems(
    jurisdiction: Jurisdiction,
    eventId: number,
  ): Promise<LegistarAgendaItem[]> {
    return this.fetchAll(jurisdiction, `/Events/${eventId}/EventItems`, {
      AgendaNote: "1",
      MinutesNote: "1",
      Attachments: "1",
      RollCalls: "1",
    });
  }

  /** @deprecated Use getAgendaItems. */
  getAgendas(
    jurisdiction: Jurisdiction,
    eventId: number,
  ): Promise<LegistarAgendaItem[]> {
    return this.getAgendaItems(jurisdiction, eventId);
  }

  getMatter(
    jurisdiction: Jurisdiction,
    matterId: number,
  ): Promise<LegistarMatter> {
    return this.fetchJson(jurisdiction, `/Matters/${matterId}`);
  }

  getMatterAttachments(
    jurisdiction: Jurisdiction,
    matterId: number,
  ): Promise<LegistarAttachment[]> {
    return this.fetchAll(jurisdiction, `/Matters/${matterId}/Attachments`);
  }

  getMatterHistories(
    jurisdiction: Jurisdiction,
    matterId: number,
  ): Promise<LegistarMatterHistory[]> {
    return this.fetchAll(jurisdiction, `/Matters/${matterId}/Histories`);
  }

  getVotes(
    jurisdiction: Jurisdiction,
    eventItemId: number,
  ): Promise<LegistarVote[]> {
    return this.fetchAll(jurisdiction, `/EventItems/${eventItemId}/Votes`);
  }

  getMeetingVotes(
    jurisdiction: Jurisdiction,
    eventId: number,
  ): Promise<LegistarAgendaItem[]> {
    return this.getAgendaItems(jurisdiction, eventId);
  }

  getBodies(jurisdiction: Jurisdiction): Promise<LegistarBody[]> {
    return this.fetchAll(jurisdiction, "/Bodies", {
      $filter: "BodyActiveFlag eq 1",
      $orderby: "BodyName asc",
    });
  }

  searchMatters(
    jurisdiction: Jurisdiction,
    searchText: string,
  ): Promise<LegistarMatter[]> {
    return this.getLegislation(jurisdiction, { text: searchText });
  }
}

export const legistar = new LegistarClient();
