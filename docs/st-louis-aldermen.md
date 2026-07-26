# St. Louis Board of Aldermen Source Contract

## Scope and official sources

The `st-louis-aldermen` scraper ingests full-board and committee meetings from
the City of St. Louis. It uses four official structured surfaces:

- the Full Board Meeting Agendas page for the selected session,
  `agendaViewID`, agenda/minutes links, Board Bills, resolutions, and sponsors;
- the Aldermanic Calendar and event pages for City event IDs, meeting times,
  types, locations, published video links, and CivicClerk meeting IDs;
- Board Bill and resolution detail pages for stable legislative IDs, titles,
  primary sponsors, latest activity, and published bill text;
- the City's keyless CivicClerk public API for committee agenda trees,
  attachments, agendas, minutes, and packets.

Production discovery fetches the agenda and calendar pages with no session
parameter and accepts only their selected `<option>` metadata. The two pages
must agree on the session ID and label. The scraper never submits the archive
selector, enumerates old session IDs, or derives a session from the current
date. A disagreement stops the run before writes.

## Identity and versioning

Meetings upsert on the shared `(source, jurisdiction, externalId)` key using
the stable City event ID. `sessionId` and `agendaViewId` retain the City source
identifiers. Agenda items use CivicClerk item IDs when available and otherwise
the stable Board Bill or resolution ID; `legislativeId` links a CivicClerk item
to its City legislative record. Sponsors remain a structured string array.

CivicClerk returns expiring signed blob URLs. Documents therefore upsert on
their stable file ID, while the current signed URL is refreshed in place. A
new file ID is a real revision: the new row becomes current and the prior row
is retained with `isCurrent=false`. City-hosted documents use a deterministic
ID derived from their stable path. Document checksums hash stable source
version metadata; meeting and item `contentHash` values cover normalized
source fields and referenced versions.

The shared schema additions are nullable source metadata on meetings/documents
plus structured legislative metadata on agenda items. They extend the existing
local-government tables; no St. Louis-specific tables or API routes exist.

## Fetch behavior and API consumption

All requests use the shared retry client with exponential/per-host backoff,
timeouts, and `Retry-After` support. The CLI's shared low concurrency limit
applies to event, agenda, CivicClerk, and legislative detail requests.
`ST_LOUIS_ALDERMEN_MAX_ITEMS` defaults to 100 and `--max-items` overrides it.

The scraper parses structured HTML and JSON directly. It does not send source
content through AI and does not run OCR when official structured fields exist.
The public `localGovernment` API reads only persisted shared tables, so product
requests never trigger a City of St. Louis or CivicClerk request.
