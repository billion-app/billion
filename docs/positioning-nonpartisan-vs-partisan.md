# Positioning: Nonpartisan vs. Bipartisan vs. Partisan

> **Status:** Decision memo / draft for founder + cofounder discussion. Not a settled change to [BRANDING.md](../BRANDING.md), which currently commits to **nonpartisan**.
> **Date:** 2026-06-13
> **Question on the table:** Now that Billion will be a **for-profit (Delaware PBC)** rather than a 501(c)(3), we are *legally free* to pick a side. Should we — to maximize impact and revenue?

---

## TL;DR

Being for-profit removes the *legal* requirement to be nonpartisan, but it does **not** make partisanship the revenue-maximizing move. Nonpartisanship in Billion's case isn't a compliance cost inherited from nonprofit status — it's the **product's core differentiator, its entire distribution strategy, and its largest addressable market.** The recommendation is to **keep the nonpartisan brand and capture the engagement upside through partisan-*aware* features** (e.g. "here's how each side frames this bill"), not by coding the whole app as one team.

This is a founder-level call. This memo lays out the tradeoff honestly, including the strongest case *for* repositioning.

---

## 1. Three distinct words, three distinct products

| Stance | What it means | What it assumes |
|---|---|---|
| **Partisan** | Billion has a side; content is framed for one team. | One team is right; we serve them. |
| **Bipartisan** | "Both sides at the table," balanced D-vs-R. | There are exactly two legitimate poles; our job is the midpoint. |
| **Nonpartisan** | Party isn't the organizing frame at all — here's the bill, the ruling, the sources. | Facts first; party is one lens among several, not the structure. |

**Billion already chose nonpartisan, deliberately** ([BRANDING.md](../BRANDING.md)):
- *"The goal is informed citizens, not aligned ones."*
- *"Civic, not political... without borrowing from any political party's color coding."* The content-type palette (blue/indigo/teal) was picked **specifically to avoid red-vs-blue.**
- Hard "Don't": *"Use color in any way that accidentally codes as partisan (no red-vs-blue framing)."*

The brand's stance is stronger than "we're neutral" — it's "we refuse to make party the lens." **Bipartisan would re-introduce the red/blue frame the brand spent effort removing.**

---

## 2. Why "we don't *have* to be nonpartisan" ≠ "partisan maximizes revenue"

The legal claim is correct. The revenue claim is a separate question, and the evidence points the other way.

### 2a. Partisan is the red ocean; neutral is the open lane
Partisan political content is the **most saturated category in all of media** — cable, every Substack, every podcast, all of political social. A partisan Billion is competitor #10,000 fighting for half the country with a worse brand and no audience. The *unoccupied* lane is "explain what government actually did, no team." Differentiation lives in the neutral position, not the partisan one.

### 2b. Picking a side caps and mis-targets the market
Coding partisan loses ~half the country **and** the segment Billion was built for: the politically **exhausted / tuned-out majority**. Those people don't avoid politics for lack of a team — they avoid it because it's *all* teams. A partisan Billion sells to the already-engaged and repels its own stated target audience ("should be informed but aren't").

> _Market-size figures to be inserted from market research — see §5._

### 2c. Partisan coding **closes the distribution doors** we just opened
This session built a distribution pipeline of **32 partner targets**: League of Women Voters, public libraries (SJPL, SCCLD), the SCC Registrar of Voters, SJSU, city-council newsletters. **None of these can touch a partisan app.** Libraries, public universities, K-12, and election offices are bound to neutrality; brand advertisers and app-store featuring apply "brand safety" rules that penalize partisan political content. Going partisan trades a working pilot channel for nothing.

### 2d. The PBC structure was chosen *because* of the engagement trap
Per [issue #111](https://github.com/billion-app/billion/issues/111): the PBC was selected so the board has **legal cover to decline engagement-maximizing-but-toxic features** without breaching fiduciary duty. Partisan-for-engagement isn't a clever new revenue idea — it's the *specific failure mode* the company's legal structure was built to resist.

### 2e. Investor pool
Billion's funding thesis is impact/mission VC. #111 already flags an **avoid list of overtly partisan funders** (Higher Ground Labs, New Media Ventures) because taking their money "would brand us partisan and undercut the nonpartisan thesis." Going partisan doesn't just risk the brand — it shrinks the fundable investor set Billion was targeting.

> _Investor-appetite evidence to be inserted from market research — see §5._

---

## 3. The strongest *honest* case FOR repositioning (steelman)

Not dismissing the instinct — here's where it has real force:

- **Engagement economics are real.** Partisan/outrage content demonstrably drives higher engagement-per-user in the short term. If the monetization model is ad-impression- or time-on-app-based, that matters.
- **"Bipartisan" can be a *feature* selling point.** A "where left and right actually agree on this bill" feature is *legitimately* bipartisan and would be a differentiator — at the feature level, not the brand level.
- **Neutrality can read as "wishy-washy"** to an audience that wants a POV. Some users distrust "we don't take sides" as evasive.
- **A defined partisan audience is easier to acquire and retain early** than a diffuse "everyone" — narrow beachheads sometimes beat broad neutrality at the seed stage.

> _Evidence on whether these outweigh the nonpartisan case to be inserted from market research — see §5._

---

## 4. The recommended path: nonpartisan brand, partisan-*aware* features

The middle path captures the engagement upside **without** selling the moat:

- **Brand stays nonpartisan** → keeps 100% of TAM, the full distribution pipeline, the impact-VC pool, and the one-sentence value prop ("the place that tells you what happened, no team").
- **Features get partisan-*aware*** → "here's how each side frames this," personalized relevance, a both-sides debate/common-ground feature. This is **already in the brand** as the *Dual-Lens Commitment* ("perspectives from across the political spectrum, side by side") — it's an asset to lean into, not a new pivot.

This is the "have the cake" position: engagement lever pulled, moat intact.

---

## 5. Market evidence

> Source: `billion-positioning-market-research` workflow, 2026-06-13 (43 findings → 13 load-bearing claims adversarially fact-checked). Figures below survived that check; where a fact-check **corrected** the original claim, the corrected version is what's shown. Several revenue numbers are inherently third-party estimates — flagged as such.

### 5a. Neutrality demonstrably *can* monetize — and converts unusually well

- **Tangle** (Isaac Saul's nonpartisan "what the Left and Right are saying" newsletter) is the cleanest proof. Verified: **~$4.15M 2025 revenue** (85% subscriptions, 15% ads), **~470K free + 71K paid** subscribers, **~16% free-to-paid conversion**, ~60% open rates, and 2025 growth of paid +23% / free +38% / MRR +42% (Press Gazette, corroborated by Nieman Lab, A Media Operator, Inbox Collective). That **16% conversion is 3–5× the typical newsletter** (~3% median; Substack cites 5–10%) — evidence that explicitly-neutral framing drives unusually high willingness-to-pay. *Caveat the fact-check insisted on: the "rural conservatives and progressives both trust it" line is the founder's mission framing, not survey data.*
- **Ground News** — the closest product analog (nonpartisan bias-comparison news app, freemium) — is real and growing, distributed heavily through creator/influencer sponsorships (1,863 sponsored-video integrations / 664M views in a 2025 sample, the top sponsor in that set, +202% YoY). Revenue is **modest and unaudited** (~$5.7M Growjo estimate; third-party only). Confirms the model works *and* that its growth engine is YouTube creators, not partisan virality.

### 5b. The partisan "ceiling" is real but currently *collapsing* — and the academic evidence cuts against the engagement thesis

- The steelman claim that partisan players hit a higher revenue ceiling is **directionally true but overstated**. The Daily Wire's **$200M is a self-reported *peak*, not current** — as of mid-2026 it's in documented decline (~60% staff cut over 13 months, large audience drop). A peak-then-collapse is exactly the durability risk a brand bets against.
- **Strongest causal evidence (verified academic paper — Yan & Miller, "Engagement vs. Commitment," 2026, arXiv 2605.18357):** using instrumental-variable identification on a major European newspaper's user-level data, polarizing content **raises time-on-site but does *not* help (and tends to hurt) paid subscription/commitment.** Engagement and revenue diverge. *The fact-check trimmed the original "actively hurts / opposite of theory" to this more precise version — but the direction stands: outrage ≠ durable revenue.*
- **Insider/B2B partisan media monetizes at high per-user rates** (Punchbowl ~$20M 2023, now ~$385/yr; Puck) — but via **professional/insider subscriptions**, the opposite of Billion's mass-consumer, tuned-out audience. Not a model Billion can copy.

### 5c. Distribution / brand-safety penalizes *all* political content — so partisanship adds risk without escaping the baseline

- **Brand-safety keyword blocklists demonetize political/news content regardless of slant:** ~**54% of news URLs** that contextual targeting cleared would still trip a typical keyword blocklist; ~**57–70% of blocking is "unnecessary"** (IAS/CHEQ data — note these vendors sell the alternative, so treat as directional). Takeaway: Billion already eats the "news is hard to monetize via ads" tax *whether or not* it's partisan — so going partisan buys none of the upside and adds the downside below.
- **Deplatforming risk is concentrated on partisan products:** Parler was removed from Apple, Google Play, and AWS within ~48–72 hours in Jan 2021 (trigger was content-moderation failure tied to Jan 6, not slant per se — but the lesson holds: partisan-coded apps carry platform-dependency tail risk a neutral civic tool largely avoids).
- *(Implication for Billion's pipeline: the 32 library/university/election-office partners from the SCC pilot are all neutrality-bound and would be unreachable to a partisan app — consistent with §2c.)*

### 5d. Market sizing — the "tuned-out" target is bigger framed as fatigue than as a missing team

- The **purely tuned-out** "should-be-informed-but-aren't" segment is real but a **minority — ~9% of US adults** ("Tuned-Out Middle," Pew typology, June 2026; the "~23M adults" version is an inference, not a Pew figure). Notably this group is **46% Dem-lean / 43% Rep-lean, 52% moderate** — i.e. *not* a partisan audience you could capture by picking a side.
- Broaden to the **polarization-fatigued** and the TAM is large: **~67% "Exhausted Majority"** (More in Common, *Hidden Tribes*) and a ~62% "messy center" (Pew 2026). **News avoidance is ~43% of US adults** and rising, with stated reasons (negativity, powerlessness, sensationalism, distrust of impartiality) that map almost exactly onto a nonpartisan civic product's pitch.
- The strategic read: the addressable market is defined by *fatigue with the fight*, not by an unserved team. Picking a side targets the small slice and alienates the large one.

### 5e. What did NOT survive / remains uncertain

- The final auto-synthesis step of the research run failed validation; this section is built directly from the **13 verified checks**, which is the more reliable layer anyway.
- **Revenue/valuation figures for private companies** (Ground News, Daily Wire current, Punchbowl) are third-party estimates or self-reported — directional, not audited.
- **Investor-appetite** for partisan-vs-nonpartisan civic for-profits was researched but not independently verified to the same bar; treat the §2e point as reasoning consistent with #111's stated avoid-list, not a measured finding.
- Brand-safety percentages originate partly from vendors selling the alternative — real effect, possibly overstated magnitude.

---

## 6. Bottom line

Nonpartisanship is not the tax Billion paid for being a nonprofit — **it's the asset that would be sold off** by repositioning. Drop it and Billion isn't a leaner for-profit; it's a generic partisan news app with no differentiation in the most crowded market on earth, locked out of its own distribution channels. Keep the nonpartisan **brand**; monetize the engagement upside through partisan-**aware features** the brand already promises.

If we still want to revisit this, the right next step is to test the *feature* hypothesis (does a both-sides feature lift retention?) **before** touching the brand — the brand change is hard to reverse, the feature experiment is cheap.
