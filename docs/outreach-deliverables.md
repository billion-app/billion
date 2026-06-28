# Outreach Deliverables — What "Done" Means per Task Type

> Companion to the **[Outreach Tracker](https://github.com/orgs/billion-app/projects/3)**. The tracker says *what* we're chasing and *where it stands*; this doc says *what finishing a task actually requires*. Each outreach item has a **Track**, and each track has a different definition of done. Use this to know when to move a task's **Stage** forward and what artifact to attach.
>
> Source research: issues [#111](https://github.com/billion-app/billion/issues/111) / [#113](https://github.com/billion-app/billion/issues/113) / [#114](https://github.com/billion-app/billion/issues/114), `docs/research/api-pricing-and-incorporation-2026.md`, and `Outreach Plan (help from Claude).docx.pdf`.

## How the Stage field maps across all tracks

`Not Started → Researching → Draft Ready → Sent → In Conversation → Won / Declined / Parked`

The stages mean slightly different things per track (a "Send" for an investor is a pitch email; for a no-outreach API source there is nothing to send). The per-track sections below define the concrete exit criteria for each stage.

---

## 1. Data Partner

**Examples:** Vote Smart, League of Women Voters / Vote411.
**Goal:** a signed (or verbally-agreed) data-sharing arrangement that makes a source's data usable *compliantly* — not scraped against ToS.

**Definition of done (`Won`):** the partner has agreed, in writing, to let Billion use their data, and we know the attribution / nonpartisanship / no-redistribution terms we must honor.

**Required deliverables, in order:**
1. **Use-case + ToS memo** (during `Researching`) — one paragraph on exactly what data we want and why, plus the specific ToS clause(s) that gate it (e.g. Vote Smart's "campaign activity" bar; Vote411's written-consent requirement). This is already captured in each item's description.
2. **Outreach email** (`Draft Ready`) — a finalized email with `[NAME]`/`[CONTACT]` filled in. Drafts exist in #111 §2; **nothing has been sent**.
3. **Sent record** (`Sent`) — date sent + recipient logged in **Next Action** / description. Set **Date First Outreach** mentally to the send date (note it in the body).
4. **Logged response** (`In Conversation`) — paste their reply (or "no response after N days → follow-up scheduled") into the description. Capture any terms they name.
5. **Terms summary + entity note** (`Won`) — a short written summary of the agreed terms. ⚠️ **Signing a data contract requires a legal entity** (Delaware PBC) and likely a lawyer; the entity is pulled by the deal, not a prerequisite for steps 1–4. Flag this the moment a partner says yes.

**Not done if:** we're only scraping their site, or the only "agreement" is an unanswered email.

---

## 2. Impact Investor

**Examples:** Mozilla Ventures, Urban Innovation Fund, Better Ventures, Impact America Fund, Knight Enterprise Fund.
**Goal:** get in front of a fund that funds nonpartisan civic for-profits/PBCs and move toward a check — without branding Billion partisan.

**Definition of done (`Won`):** a term sheet or committed investment. Realistically, a single task's done = **pitch delivered and a reply logged** (the actual raise spans many tasks); use `In Conversation` for "they replied / took a meeting" and `Won` only for committed capital.

**Required deliverables, in order:**
1. **Fit note** (`Researching`) — why this fund fits and the partisan-risk read (already in each description). Confirm they're not on the avoid list (Higher Ground Labs, New Media Ventures — overtly progressive).
2. **Pitch email + deck** (`Draft Ready`) — the email draft (in #111 §3) finalized, plus a one-pager/deck and the `[round]`/`[use of funds]` blanks filled. **The deck is a shared dependency across all investor tasks** — build it once.
3. **Sent record** (`Sent`) — date + channel (warm intro preferred; note who introduced).
4. **Logged response + next step** (`In Conversation`) — their reply, meeting date, or pass; set **Next Action Date** for the follow-up.
5. **Outcome** (`Won`/`Declined`) — term sheet attached, or a one-line reason for the pass (useful signal for the next fund).

**Special case — Knight Enterprise Fund:** stays `Parked` until a lead investor or warm intro exists. Its deliverable is *not* a cold email; it's "identify a warm path," because it's relationship-gated (this is how Knight invested in Bluesky, PBC).

**Not done if:** we sent a cold email and called it a raise. Done = capital committed; interim = reply logged.

---

## 3. Competition / Grant

**Examples:** Diamond Challenge, T-Mobile Changemaker, Blue Ocean, Knight Cities Challenge, Conrad, NSF Civic Innovation.
**Goal:** submit a complete, on-deadline application to a non-dilutive funding opportunity we're eligible for.

**Definition of done (`Won`):** prize/grant awarded. Per-task milestone: **application submitted before the deadline**; `In Conversation` = submitted/under review; `Won`/`Declined` = result.

**Required deliverables, in order:**
1. **Eligibility + deadline confirmation** (`Researching`) — ⚠️ **deadlines roll annually; reconfirm on the official page** (every competition description says this). Verify age/location/team/structure eligibility. For Knight Cities ($200K) specifically: confirm San Jose qualifies before investing effort.
2. **Application package** (`Draft Ready`) — the full set of required materials assembled: written application/essays, pitch video if required, team info, financials/budget if required. Each competition's required pieces differ — list them in the task body once known.
3. **Submitted record** (`Sent` → treat "Sent" as "Submitted")** — submission confirmation + date logged. Set the **Deadline** field so nothing slips; **Diamond Challenge is P0 with a ~Jan concept deadline.**
4. **Result** (`Won`/`Declined`) — award amount or rejection logged.

**Priority order to actually enter (from #114):** Diamond Challenge (Social Innovation) → T-Mobile Changemaker → Blue Ocean. Watch Knight Cities if San Jose qualifies.

**Not done if:** the deadline passed, or the application is missing a required component (e.g. the pitch video).

---

## 4. Data Source (Scraper / API)

**Examples:** the 21 ballot-measure sources from the old sheet — NCSL, CA SOS (Results API + VIG Archive), LAO, SF DataSF, CEDA, SPUR, OpenElections, Google Civic, etc.
**Goal:** the source's data is flowing into the pipeline, normalized and stored — **shipped code, not an email.**

**Definition of done (`Won`):** a working, merged scraper/integration that pulls the source's data into our schema, with a citation back to the source. *This is the key difference from the other three tracks — the deliverable is a code change, not a relationship.*

**Two sub-types** (the **Outreach playbook** block in each task body says which):

**A. No-outreach sources** (free, public, scrapable — most of the list, e.g. CA SOS Results API, LAO, SF DataSF):
1. **Approach confirmed** (`Researching`) — the recommended-approach steps in the task body are validated against the live source.
2. **Integration built** (`In Progress` / map to `Sent`) — scraper written following the playbook (e.g. for VIG archive: enumerate years → scrape per-prop pages → parse H2/H3 → politeness delays).
3. **Merged + flowing** (`Won`) — data normalized into the pipeline schema, keyed correctly, with last-fetched timestamps and source citation. **Deliverable = the merged PR.**

**B. Outreach-gated sources** (need permission or a request — NCSL bulk export, CEDA, VIP, SPUR partnership, Florida DOS):
1. **The ask drafted** (`Draft Ready`) — the specific request from the task's **The ask** line (e.g. CEDA: "bulk Excel export for research/civic use").
2. **Request sent** (`Sent`) — to the **Best contact** in the task (e.g. `elections@sos.ca.gov`, `openelections@gmail.com`), date logged.
3. **Access granted or fallback chosen** (`In Conversation` → `Won`) — either they provide the export/feed, OR we fall back to the documented scraping path. Then build + merge as in sub-type A.

**Risk/mitigation is part of done** (from the Outreach Plan PDF): scrapers tagged with the source structure version; politeness delays + archived-version fallback for 403-prone sites (VIG); pdfminer for PDF states (Florida, Texas); aggressive caching since gov data has no SLA.

**Phasing (from the PDF):** CA-first. Phase 1 = CA SOS API + LAO + VIG archive + SF DataSF (mostly no outreach). Phase 2 = NCSL + OpenElections + Google Civic. Phase 3 = other states. Phase 4 = CA local (CEDA). Lowest-friction first sends: **CEDA + CA SOS VIG archive**.

**Not done if:** we got a CSV but never wrote the integration, or the scraper runs locally but isn't merged and flowing.

---

## Quick reference

| Track | Done (`Won`) = | Primary deliverable | Entity/legal needed? |
|---|---|---|---|
| **Data Partner** | Written data-sharing agreement | Sent email → logged terms | Yes, at signing (PBC + lawyer) |
| **Impact Investor** | Committed capital / term sheet | Pitch + deck sent → reply logged | Yes, at term sheet |
| **Competition/Grant** | Prize awarded | On-deadline complete application | No (PBC counts as for-profit) |
| **Data Source** | Merged scraper, data flowing | A PR (± a data-access request first) | No (APIs bill a card, not an EIN) |

**Cross-cutting rule:** a task is never "done" on a *sent email alone*. For relationship tracks (Partner/Investor) done is the agreement/check; for Competition it's an awarded result; for Data Source it's merged, flowing code. Log every send and every reply in the task's description so the pipeline reflects reality.
