# US Government Information Structure

A reference for understanding the types of government information Billion surfaces — and where each type comes from. This informs data-source decisions, content-model design, and how the app explains civic content to users.

The US has three layers of government — **federal**, **state**, and **local** — each with three branches: **legislative** (makes law), **executive** (enforces it), **judicial** (interprets it). Each branch at each layer produces distinct document types.

Most US legislatures are **bicameral** — split into two **chambers** that must each pass a bill independently before it can become law. At the federal level these are the House of Representatives (435 members, apportioned by population) and the Senate (100 members, 2 per state). California mirrors this with the State Assembly and State Senate, which is why CA bills are prefixed AB or SB.

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

#### Terminology primer

**Ballot** — the form voters fill out on election day. It lists both candidate races and policy questions side by side.

**Ballot measure** — any yes/no policy question on the ballot (as opposed to a candidate race). "Measure," "proposition," and "amendment" are all names for the same concept — states just chose different conventions. California calls statewide ones *propositions* and numbers them (Prop 13, Prop 47); Oregon calls them *measures*; Florida calls them *amendments*. Local items in California are typically called *measures* (Measure Q, Measure J). The name tells you nothing about *how* it got on the ballot — a proposition could be a citizen initiative or a legislature-referred referendum; you have to look at its origin to know which.

There are three distinct types of ballot measure:

- **Initiative** — citizens gather signatures to place a proposed law or constitutional amendment directly on the ballot, bypassing the legislature entirely. The most powerful form of direct democracy. ~26 states allow this; California is the canonical example.
- **Referendum** — a law already exists (or has been passed), and voters ratify or reject it. Either the legislature chooses to send it to voters, or opponents gather signatures to force a public vote on an already-passed law. The key distinction from an initiative: *the legislature acts first*, voters react second.
- **Recall** — voters vote to remove an elected official before their term ends. Uses the ballot mechanism but is not a policy question.

**Local measures** follow the same logic but are placed by city councils or county boards rather than statewide actors. They appear as lettered items ("Measure Q") rather than numbered propositions.

**Texas's position:** The legislature can refer *constitutional amendments* to voters — that is a legislature-referred referendum. Citizens cannot initiate anything themselves. So Texas has referendums, just not citizen initiatives.

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

## How California compares to other states

This section clarifies what generalizes from CA and what is CA-specific, so the app can be extended to new states without incorrect assumptions.

### What generalizes to almost every state

**Bicameralism.** 49 of 50 states have a two-chamber legislature. The only exception is Nebraska, which switched to a single-chamber (unicameral), nonpartisan legislature in 1937. For practical purposes, the two-chamber bill-passage model is universal.

**Three branches.** Every state has a legislative, executive, and judicial branch. The Governor-signs-bill flow mirrors the President-signs-bill flow exactly.

**Bill concept.** Every state has bills that become law when passed by both chambers (or the one chamber, in Nebraska) and signed by the governor. The Open States API covers all 50 states, so the data model generalizes even if chamber names differ.

### What varies by state

**Lower chamber name.** This affects bill prefixes and how bills are cited:

| Name | States | Bill prefix example |
|---|---|---|
| House of Representatives | 41 states (TX, FL, NY, …) | HB / SB |
| Assembly | 5 states (CA, NY lower*, NV, WI, …) | AB / SB |
| House of Delegates | 3 states (VA, WV, MD) | HB / SB |

*New York's lower chamber is called the Assembly; its bills are prefixed A and S.

CA is in the minority — most states say "HB/SB", not "AB/SB." The content model should store the full chamber name and derive the prefix from it, not hard-code "AB."

**Legislature name.** 27 states call it "the Legislature." 19 call it "the General Assembly" (including FL, CO, NY, OH, PA). MA and NH call it "the General Court."

**Session frequency.** Most state legislatures meet annually. Texas meets only in odd-numbered years (biennial sessions, a 19th-century constitutional holdover) — this has real implications for how often new bills appear and how stale cached data can get.

**Full-time vs. citizen legislatures.** CA has one of the few full-time professional legislatures. Texas legislators are paid ~$7,200/year and are explicitly a "citizen legislature." This affects how much legislative staff support exists and how much public documentation is produced.

### Direct democracy — the axis that matters most for Billion

This is where states diverge most sharply and where the coverage decision is highest-stakes.

| Category | States | Notes |
|---|---|---|
| **Citizen initiative** (voters can put statutes or constitutional amendments on the ballot by gathering signatures) | ~26 states, incl. CA, OR, CO, AZ, FL, MI, OH, NV, WA, MT, ND, SD | The strongest direct democracy. This is where the LAO-style fiscal analysis and cross-validation model applies. |
| **Popular referendum only** (voters can repeal a law the legislature passed, but cannot initiate new law) | Several states | Weaker form; fewer ballot items per cycle. |
| **Legislature-referred only** (only the legislature can put measures to voters) | ~24 states, incl. **Texas** | Voters decide on what legislators choose to send them — primarily constitutional amendments. No citizen-initiated statutes. |

**Texas specifically.** Texas has no citizen statutory initiative. The legislature can refer constitutional amendments to voters (and does — voters have approved 548 of 729 referred amendments since 1876), but citizens cannot put a law directly on the ballot. This is the opposite of CA's initiative culture. Texas also meets only every two years, so the flow of new ballot items is slow.

### Strategic implication for state expansion

The existing phasing in this doc — **FL → OR → CO → NY** — is optimized for the ballot-measure differentiator: all four have robust citizen initiative processes and high statewide proposition volume. Texas is a large market but a poor fit for measure-first expansion because:

1. No citizen statutory initiative — the primary content type driving Billion's differentiation doesn't exist there.
2. Biennial sessions — new bill/measure data arrives half as often.
3. The existing roadmap (FL, OR, CO, NY) would reach more voters *on ballot measures* than Texas would.

Texas would make sense as a target if the expansion goal shifts to **bills and state legislation** rather than ballot measures — the Open States pipeline would work there and the legislature is large and consequential. That is a valid pivot, but it is a different product bet than the one the current architecture optimizes for.

---

## Implications for content model design

**Geographic scoping is fundamental.** Federal content is relevant to every user. A CA proposition is relevant only to CA voters. A San Jose city council item is relevant only to San Jose residents. The Google Civic API (keyed by address) is the right anchor — it determines which contests are on *this person's* ballot.

**"Article" types have different fields.** A bill has sponsors, a vote record, and a committee history. A proposition has a fiscal analysis, pro/con arguments, and a ballot label. An executive order has an agency and a legal authority citation. These share the concept of "government action that affects people" but require different data shapes.

**Not all states have all types.** The ballot measure category exists only in states with direct-democracy statutes. Building out coverage state-by-state (CA first, then FL, OR, CO, NY) is the right phasing — see the [Outreach Tracker](https://github.com/orgs/billion-app/projects/3) and `docs/measure-enrichment.md`.

**Ballot measures are the differentiator.** Most civic apps focus on candidates and elections. The measure space — propositions, local bonds, recalls — is where Billion has the most unique coverage potential: the data gap is largest, the information is genuinely hard to find, and the free official sources (LAO, SOS, county registrars) are better than what paid aggregators provide.
