# Billion — Full App Redesign Brief

## What This App Is

Billion is an AI-powered civic engagement mobile app that transforms bills, court cases, executive orders, and local laws into accessible short-form content for everyday Americans. It scrapes public political data (Congress.gov, whitehouse.gov, federal courts, local Legistar APIs) and repackages it as short videos, interactive articles, and visual explainers.

**The Bradbury Principle:** Every piece of content is a gateway, not a destination. If a user feels they "got the gist" and never digs deeper into the source material, we've failed. Every screen must have an exit point leading deeper.

**Dual-Lens Commitment:** Every topic presents viewpoints from across the political spectrum, transparently and side by side. We surface bias rather than pretending neutrality.

**Target audience:** American voters — not policy wonks or journalists. People who should be informed about what their government is doing but aren't because the information is buried in legalese.

**Brand personality (hold the tension, don't resolve it):**
- **Authoritative** — serious civic information, institutional weight. Courthouse columns, not startup gradients.
- **Classy** — refined, not dumbed down. Serif typography, deliberate spacing, premium dark palette.
- **Sleek & Fun** — civic engagement shouldn't feel like homework. Smooth interactions, satisfying animations, an app people *want* to open.

**The feeling:** Walking into a beautifully designed civic library that also has great Wi-Fi.

---

## Design System (Current — Preserve or Refine)

### Colors

**Primary Palette:**
- Deep Navy `#0E1530` — primary background, app chrome (this is the brand, NOT a "dark mode")
- Slate `#272D3C` — cards, elevated containers
- Higher surface `#323848` — popovers, dropdowns, nested elements
- White `#FFFFFF` — primary text on dark surfaces
- Black `#000000` — text on light surfaces only

**Content Type Colors (the ONLY saturated colors in standard UI):**
- Bills: Civic Blue `#4A7CFF`
- Executive Actions: Deep Indigo `#6366F1`
- Court Cases: Teal `#0891B2`
- General/News: Muted `#8A8FA0`

These appear as badge fills and subtle accent borders on content cards. Chosen to avoid red/blue partisan associations.

**Semantic:** Success `#10B981`, Warning `#F59E0B`, Error `#EF4444`, Text Secondary `#8A8FA0`

**Signature gradient (hero moments only, never on small components):**
`linear-gradient(180deg, #0E1530 0%, #272D3C 100%)`

**Depth through layering, not color variation.** Think architectural planes — card above background, modal above card. The eye reads depth, not color.

### Typography

Deliberate serif-to-sans progression mirroring brand personality:

| Role | Font | Weight | Size |
|------|------|--------|------|
| Headlines | IBM Plex Serif | Bold 700 | 32px |
| Subheadings | Inria Serif | Bold 700 | 22-24px |
| Body | Albert Sans | Regular 400 | 18px |
| Small/UI | Albert Sans | Medium 500 | 16px |
| Micro | Albert Sans | Medium 500 | 12-14px |

- IBM Plex Serif = authority and institutional credibility (serious but contemporary)
- Inria Serif = transitional, warmer, literary (bridges authority and accessibility)
- Albert Sans = clean, geometric, legible (the "sleek and fun" voice)
- Signature move: italic IBM Plex Serif for emphasis within bold headlines (elegance)
- Never use serifs for body text. Never use sans-serif for headlines.
- Let serif headlines breathe — large sizes, generous whitespace, considered placement.

### Components

**Buttons:**
- Primary CTA: white pill (border-radius: 9999px), black text, 48-52px height, full-width
- Secondary: no background, white text, underline on press
- Content type badges: rounded rect (8px), type color fill, white uppercase text 12px

**Cards:**
- Slate background, 14-16px radius, 16-24px padding
- 1px border `rgba(255, 255, 255, 0.06)` or subtle shadow
- Content type badge at top, headline in Inria Serif, preview in Albert Sans, metadata in secondary color

**Navigation pills:**
- Active: white fill, black text, pill shape
- Inactive: transparent, 1px white/10% border, white text at 60% opacity

**Inputs:**
- Slate background, 1px `rgba(255, 255, 255, 0.1)` border, 12px radius
- White text, placeholder `#8A8FA0`

### Spacing & Motion
- Scale: 4/8/16/24/32/48px
- Border radius: 6 (small) / 8 (badges) / 14 (cards) / 20 (modals) / 9999 (pills)
- Shadows: deep and soft, reinforcing layered dark aesthetic. No colored glows.
- Motion: 150-400ms, ease-out. Present but never performative. Nothing bounces. Nothing spins.

### Accessibility
- Minimum 16px for readable text
- 44×44px minimum touch targets (48×48 preferred)
- WCAG AA contrast minimum (most combos exceed AAA)

---

## The Mission

Billion aims to be **the center for political information and discourse in America.** Design whatever screens, navigation structure, and user flows best serve that mission.

### Content available in the system
- **Bills** — Congressional legislation with sponsor, status, full text, AI-generated explainers
- **Executive Actions** — orders, memoranda, proclamations, fact sheets from the White House
- **Court Cases** — federal cases including Supreme Court, with status tracking and plain-language analysis
- **Local legislation** — city/county bills via Legistar APIs
- **Elections** — ballot measures, candidates, key dates, voter info by address

### Core capabilities to support
- Consuming political content in accessible, engaging formats
- Always being able to read the original source material (Bradbury Principle)
- Seeing multiple political perspectives on any topic (Dual-Lens Commitment)
- Personalizing what content you see
- Local civic engagement (elections, local laws)
- User account and preferences

Design the complete app — decide what screens exist, how they connect, and what the experience feels like. This is a mobile app (React Native/Expo, iOS-focused).

---

## Hard Rules

- Dark-first is the identity, not a mode. Deep Navy is always the default canvas.
- No colors that code as politically partisan (no red-vs-blue framing)
- Serifs for display, sans-serif for body — never cross them
- Pill-shaped buttons for all primary actions
- No glassmorphism, no colored glows, no gradient on small components
- Every content screen needs a "dig deeper" exit to source material
- Authority leads, fun follows — they coexist but authority is first
- Mobile-first, iOS-focused aesthetic

Design high-fidelity mockups for the complete app.
