const SCOTUS_NAMES = [
  "Supreme Court of the United States",
  "HTTPS://WWW.COURTLISTENER.COM/API/REST/V4/COURTS/SCOTUS/",
  "https://www.courtlistener.com/api/rest/v4/courts/scotus/",
];

/** Earlier CourtListener imports mistook the v4 court hyperlink for a name. */
export function courtIdentityNames(court: string): string[] {
  return SCOTUS_NAMES.includes(court) ? [...SCOTUS_NAMES] : [court];
}
