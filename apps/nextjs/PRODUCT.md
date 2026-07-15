# Product

## Register

brand

## Users

American voters — not policy wonks, not journalists, not political junkies. People who *should* know what bills are moving, what the President just signed, and what courts just ruled, but currently don't, because the source material is locked behind legalese and institutional websites nobody visits. They land on this page from a link or a share, on a phone, in a spare moment, and decide in seconds whether this feels like a credible, well-made civic product or another AI content mill fishing for an email address.

## Product Purpose

Billion is an AI-powered mobile app that turns bills, executive orders, and federal court cases into short, source-linked briefs — video, interactive articles, and dual-perspective analysis. The landing page's job is narrow: earn trust fast and convert that trust into a waitlist signup. Success is a signup from someone who understood what they were joining, not a pretty scroll they bounced from.

## Brand Personality

Three voices held in tension, deliberately never resolved (from BRANDING.md): **Authoritative** (institutional weight — courthouse columns, not startup gradients), **Classy** (refined, respects the reader's intelligence, never dumbed down), **Sleek & Fun** (civic engagement shouldn't feel like homework — motion should be satisfying, not performative).

The **Bradbury Principle** is the load-bearing idea: Billion is a gateway to primary sources, never a replacement for reading them. Every section of the page should make the reader want to go verify something, not just accept a summary. The site's own construction should demonstrate this, not just claim it in copy.

## Anti-references

Generic AI-generated SaaS landing pages — the specific tells this project already has and must remove:
- The invented gold/"old-money" accent (`#c4a35a`) and its glow/gradient treatments used throughout the current build. It is not in BRANDING.md and reads as a startup-luxury cliché bolted onto a civic-institutional brand.
- The 2.3s spinning/rotating logo intro overlay on every page load.
- Tiny uppercase tracked "eyebrows" repeated above nearly every section.
- Glow/shimmer bubbles, glassmorphism panels, identical fade-up-on-scroll reveals applied uniformly to every block.
- Hero-metric templates and generic pill-badge decoration.

Reference points to chase instead, translated into a serious civic register (not copied literally):
- **usecardboard.com** — fluid, scroll-linked storytelling and a real interactive "editor" embedded directly in the page: content that responds to the user's input, not just their scroll position.
- **godrift.ai** — confident, single scroll choreography rather than scattered micro-animations. (Its generative interactive background is explicitly out of scope — wrong tone for Billion.)

## Design Principles

1. **One signature interactive moment, not decoration everywhere.** The raw-source → Billion-brief transformation *is* the product. It should be the thing people remember and should be genuinely interactive, not just scroll-scrubbed.
2. **The page proves the Bradbury Principle in its own construction.** Any claim about a bill/order/case shown on the page should feel traceably real, sourced, and verifiable.
3. **Restraint reads as institutional trust.** Overdesigning any single element (glow, gradient, gold) undercuts "authoritative" faster than it earns "sleek."
4. **Motion is choreography, not decoration.** A small number of deliberate, confident, ease-out sequences beat many scattered micro-animations or one identical reveal repeated on every section.
5. **Hold the tension.** Never fully dry/wonky, never fully playful/bouncy.

## Accessibility & Inclusion

WCAG AA minimum (≥4.5:1 body text contrast, ≥3:1 for large text and UI elements), 44×44px minimum touch targets, visible focus rings on every interactive element, a full `prefers-reduced-motion` alternative for every animation (crossfade / instant, no scroll-scrubbing or parallax), no user-facing text below 16px, no motion-only affordances.
