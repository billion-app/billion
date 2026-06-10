# US Government Information Structure

A reference for understanding the types of government information Billion surfaces — and where each type comes from. This informs data-source decisions, content-model design, and how the app explains civic content to users.

The US has three layers of government — **federal**, **state**, and **local** — each with three branches: **legislative** (makes law), **executive** (enforces it), **judicial** (interprets it). Each branch at each layer produces distinct document types.

---

## Federal

### Legislative — Congress

| Document type | What it is | Current coverage |
|---|---|---|
| **Bill** | A proposal that becomes law if both chambers pass it and the president signs | ✓ `congress.ts` scraper |
| **Resolution** | Narrower than a bill: simple (one chamber), concurrent (both), joint (can carry legal weight) | Not covered |
| **Committee report** | Analysis a committee writes before a floor vote; authoritative on legislative intent | Not covered |
| **Congressional Record** | Floor-session transcript; useful for understanding why a law was written | Not covered |

### Executive — President

| Document type | What it is | Current coverage |
|---|---|---|
| **Executive Order** | Legally binding direction to federal agencies | ✓ Federal Register scraper |
| **Proclamation** | Mostly ceremonial; occasionally carries policy weight (tariffs, immigration status) | ✓ Federal Register scraper |
| **Presidential Memorandum** | Internal executive-branch policy direction; less formal than an EO | ✓ Federal Register scraper |
| **Federal regulation** | The detailed rules agencies write to implement vague statutory authority (EPA, FDA, FTC, etc.); published in the Federal Register, compiled into the CFR. **More daily-life law comes from regulations than from bills.** | Partial — Federal Register fetched but regulations are a distinct content type from proclamations/EOs |
| **Agency guidance** | Softer than a regulation but still influential; product approvals, enforcement policies | Not covered |

> **The regulation gap.** No consumer-facing product explains federal regulations well. The Federal Register is public but nearly unreadable. This is probably the largest underserved category in civic information.

### Judicial — Federal Courts

| Document type | What it is | Current coverage |
|---|---|---|
| **SCOTUS opinion** | Supreme Court decision; sets binding national precedent | ✓ `scotus.ts` scraper (CourtListener) |
| **Circuit Court opinion** | 13 circuits; binding within their region. Circuit splits often predict SCOTUS grants | Not covered |
| **District Court opinion** | Trial-level; less precedential but newsworthy in high-profile cases | Not covered |

---

## State (using California as primary example)

### Legislative — State Legislature

| Document type | What it is | Current coverage |
|---|---|---|
| **State bill** | Same concept as federal bill; CA uses AB (Assembly) and SB (Senate) numbering | Partial — Open States API key held; integration planned |
| **State resolution** | Same as federal equivalents | Not covered |

### Executive — Governor

| Document type | What it is | Current coverage |
|---|---|---|
| **Governor's Executive Order** | Governors issue these too; CA's have been high-profile (COVID, water restrictions) | Not covered |
| **State regulation** | Each state has agencies (CA DMV, CARB, etc.) writing state-level rules; CA publishes in the CCR | Not covered |

### Judicial — State Courts

| Document type | What it is | Current coverage |
|---|---|---|
| **State Supreme Court opinion** | Binding on all courts in the state | Not covered |
| **Court of Appeal opinion** | CA has 6 districts; binding within their district | Not covered |

### Direct democracy — Ballot measures

This is what makes states unique. The federal government has no equivalent — federal law cannot be made by referendum. About 26 states allow some form of direct democracy. Texas, for example, has almost none.

| Document type | What it is | Current coverage |
|---|---|---|
| **Initiative / Proposition** | Citizens or the legislature put a law or constitutional amendment directly to voters. The LAO writes the fiscal analysis; the AG writes the official title and summary | ✓ Cross-validation engine, CA SOS, LWV, LAO, Ballotpedia |
| **Referendum** | Legislature passes something and sends it to voters, or opponents gather signatures to put an already-passed law to a vote | Covered via Google Civic + cross-validation |
| **Recall** | Voters vote to remove an elected official before their term ends | Not covered as a distinct type |

**The LAO's role.** For every California statewide proposition, the Legislative Analyst's Office writes an independent fiscal impact analysis. It is the only truly neutral source on what a measure costs or saves — proponents and opponents both quote selectively; the LAO runs the actual numbers. See `packages/api/src/lib/measure-sources/ca-lao-fiscal.ts`.

---

## Local

This is where the most government decisions affecting daily life are made — and the least-covered by existing civic apps. There are roughly 90,000 local governments in the US.

| Body | What it does | Current coverage |
|---|---|---|
| **City council** | Passes local ordinances, approves budgets, issues permits | ✓ Legistar integration (San Jose, Santa Clara County, Sunnyvale) |
| **County board of supervisors** | County-level governance; often controls health, courts, elections | ✓ Legistar (Santa Clara County) |
| **Local ballot measures** | Cities and counties put bond measures, tax increases, and charter amendments to voters; appear as lettered measures ("Measure Q") | ✓ Ballotpedia adapter, SCC CVIG scraper, SPUR grounded fallback |
| **School board** | Elected body governing a school district; controls curriculum, budgets, personnel. Increasingly high-engagement, low-information races | Not covered |
| **Special districts** | Water, transit (BART, VTA), fire, hospital, utility districts — each with an elected board. A significant share of property tax goes to ~5–10 special districts per household | Not covered |

> **The special-district gap.** Most people don't know their water district or hospital district has elected officials. These races are often decided by a few hundred votes from an almost entirely uninformed electorate. They are also almost entirely absent from every civic app.

---

## Coverage map

| Layer | Branch | Type | Coverage today |
|---|---|---|---|
| Federal | Legislative | Bills | ✓ |
| Federal | Legislative | Regulations | Partial |
| Federal | Executive | Presidential actions (EO, proclamation, memoranda) | ✓ |
| Federal | Judicial | SCOTUS opinions | ✓ |
| State (CA) | Legislative | State bills | Planned (Open States) |
| State (CA) | Direct democracy | Statewide propositions | ✓ |
| State (CA) | Direct democracy | LAO fiscal analyses | ✓ |
| Local | Council/Board | City/county legislation | ✓ (Legistar) |
| Local | Direct democracy | Local ballot measures | ✓ (Ballotpedia, SPUR) |
| Local | Special districts | Board actions, elections | Not started |
| Local | School boards | Board actions, elections | Not started |

---

## Implications for content model design

**Geographic scoping is fundamental.** Federal content is relevant to every user. A CA proposition is relevant only to CA voters. A San Jose city council item is relevant only to San Jose residents. The Google Civic API (keyed by address) is the right anchor — it determines which contests are on *this person's* ballot.

**"Article" types have different fields.** A bill has sponsors, a vote record, and a committee history. A proposition has a fiscal analysis, pro/con arguments, and a ballot label. An executive order has an agency and a legal authority citation. These share the concept of "government action that affects people" but require different data shapes.

**Not all states have all types.** The ballot measure category exists only in states with direct-democracy statutes. Building out coverage state-by-state (CA first, then FL, OR, CO, NY) is the right phasing — see the [Outreach Tracker](https://github.com/orgs/billion-app/projects/3) and `docs/measure-enrichment.md`.

**Ballot measures are the differentiator.** Most civic apps focus on candidates and elections. The measure space — propositions, local bonds, recalls — is where Billion has the most unique coverage potential: the data gap is largest, the information is genuinely hard to find, and the free official sources (LAO, SOS, county registrars) are better than what paid aggregators provide.
