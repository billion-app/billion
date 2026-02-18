# Billion — Brand Bible

**Version 2.0 · February 2026**

---

## 1. What Billion Is

Billion is an AI-powered mobile app that makes political information accessible through engaging, short-form content. It transforms bills, court cases, presidential actions, and local laws — historically locked behind legalese and institutional opacity — into short videos, interactive articles, and visual explainers that everyday Americans can actually consume.

### The Problem

If someone asked you right now what laws are about to be passed, what cases are being decided, or what the President signed last week, you'd probably draw a blank — or you'd recall only the most sensational headlines from social media. The information exists. Access to it, in any meaningful sense, does not.

A well-informed people is the foundation of democracy. The current information gap is not a convenience problem — it's a structural threat.

### The Billion Approach

Billion addresses this by scraping, processing, and repackaging three categories of public political content:

- **Bills** — Congressional legislation from GovTrack and Congress.gov, including sponsor, status, full text, and AI-generated accessible articles
- **Government Content** — Executive orders, memoranda, proclamations, fact sheets, and briefings from whitehouse.gov
- **Court Cases** — Federal cases including Supreme Court and circuit court decisions, with status tracking and plain-language analysis

Each piece of content is enhanced with AI-generated summaries, engaging long-form articles, relevant imagery, and version tracking via content hashing. The system regenerates content only when the source material changes.

### Content Formats

- **Feed previews** — Short-form video clips and tweet-length summaries designed to hook attention
- **Interactive articles** — AI-generated long-form explainers with personalizable length, style, and relevance framing
- **Dual-perspective analysis** — Every topic presented with viewpoints from across the political spectrum, transparently and side by side

---

## 2. Brand Philosophy

### The Bradbury Principle

We are not a summarization engine. Billion doesn't exist to replace reading — it exists to *start* reading. Every piece of content we produce should function as a gateway, not a destination. If a user walks away feeling they "got the gist" and never digs deeper, we've failed. If they walk away curious and equipped to explore the source material, we've succeeded.

This is the single most important design principle in the product. It should inform every content format, every UI pattern, and every editorial decision. Name it in product discussions: *"Does this violate the Bradbury Principle?"*

### Dual-Lens Commitment

Billion presents perspectives from across the political spectrum — deliberately and transparently. We acknowledge that AI-generated content carries inherent bias, and rather than pretending neutrality, we surface multiple viewpoints side by side. The goal is informed citizens, not aligned ones.

### Target Audience

American voters — the common people. Not policy wonks, not political junkies, not journalists. The people who *should* be informed about what their government is doing but currently aren't, because the information is buried in legal language and institutional websites nobody visits.

### Brand Personality

Billion speaks with three voices simultaneously:

- **Authoritative** — We handle serious civic information. The design must convey trust, credibility, and institutional weight. Think courthouse columns, not startup gradients.
- **Classy** — We respect our users' intelligence. The aesthetic is refined, not dumbed down. Serif typography, deliberate spacing, dark palettes that feel premium.
- **Sleek & Fun** — Civic engagement shouldn't feel like homework. Interactions should be smooth, animations should be satisfying, and the overall experience should make people *want* to open the app.

The tension between "authoritative" and "fun" is the brand. Don't resolve it — hold it.

### Partnerships & Aspirations

The long-term vision: become the definitive platform for civic knowledge and political discourse. Potential partnerships with organizations like Ground News. Potential features like "how will this affect X" impact analysis. The brand system should be built to scale toward that ambition.

---

## 3. Color System

### Primary Palette

| Role | Hex | Usage |
|------|-----|-------|
| **Deep Navy** | `#16182A` | Primary background, app chrome, headers, base surface |
| **Slate** | `#272D3C` | Secondary surfaces, cards, elevated containers |
| **White** | `#FFFFFF` | Primary text on dark, key UI elements, button fills |
| **Black** | `#000000` | Text on light surfaces, high-contrast elements |

### Background Hierarchy

The app uses surface layering rather than color variation to create depth:

1. **Base** — Deep Navy (`#16182A`): the default canvas everywhere
2. **Elevated** — Slate (`#272D3C`): cards, containers, modals floating above base
3. **Highest** — Slightly lighter than Slate or with subtle border separation: popovers, dropdowns, nested elements

### Signature Gradient

A subtle dark gradient used for hero moments, onboarding screens, and key decision points:

`linear-gradient(180deg, #16182A 0%, #272D3C 100%)`

This is for full-bleed surfaces only — never apply it to small components.

### Content Type Colors

Distinct colors help users instantly identify what kind of political content they're looking at:

| Type | Color | Hex |
|------|-------|-----|
| **Bill** | Civic Blue | `#4A7CFF` |
| **Executive Action** | Deep Indigo | `#6366F1` |
| **Court Case** | Teal | `#0891B2` |
| **General / News** | Muted | `#8A8FA0` |

These appear as badge fills and subtle accent borders on content cards. They should be the *only* saturated colors in the standard UI — everything else is navy, slate, white, and black.

### Semantic Colors

| Role | Hex | Usage |
|------|-----|-------|
| **Success** | `#10B981` | Confirmations, positive status |
| **Warning** | `#F59E0B` | Alerts, attention needed |
| **Error** | `#EF4444` | Errors, destructive actions |
| **Text Secondary** | `#8A8FA0` | Captions, timestamps, metadata |

Keep semantic colors muted and functional — they should never dominate the visual field.

### Color Rules

**Do:**
- Use Deep Navy as the default background throughout the app — dark is the primary surface, not a "mode"
- Use Slate to create layered depth (cards floating above background)
- Use White for all primary text on dark surfaces
- Reserve content type colors for badges and subtle accents only
- Maintain WCAG AA minimum contrast ratio (4.5:1) for all text

**Don't:**
- Introduce bright accent colors outside the content type system
- Use mid-grays for text on dark backgrounds without checking contrast
- Apply the gradient to buttons, chips, or small components
- Use pure Black (`#000000`) as a background — Deep Navy is our dark
- Use color in any way that accidentally codes as politically partisan (no red-vs-blue framing)

---

## 4. Typography

### Type Stack

| Role | Font | Weight | Size | Usage |
|------|------|--------|------|-------|
| **Headlines** | IBM Plex Serif | Bold (700) | 32px | Screen titles, hero statements, article headlines |
| **Subheadings** | Inria Serif | Bold (700) | 22–24px | Section headers, card titles, pull quotes |
| **Body** | Albert Sans | Regular (400) | 18px | Article text, descriptions, primary readable content |
| **Small / UI** | Albert Sans | Medium (500) | 16px | Captions, button labels, metadata, form inputs |
| **Micro** | Albert Sans | Medium (500) | 12–14px | Timestamps, badges, legal text, fine print |

### Line Heights

| Role | Line Height |
|------|-------------|
| Headlines | 1.2× |
| Subheadings | 1.3× |
| Body | 1.5× |
| Small / UI | 1.4× |

### Pairing Rationale

The type system uses a deliberate serif-to-sans progression that mirrors the brand personality:

**IBM Plex Serif** at the headline level establishes authority and institutional credibility. It's a modern serif with strong geometry — serious but contemporary. This is the voice that says "this is real civic information."

**Inria Serif** serves as the transitional voice. Warmer and more literary than IBM Plex Serif, it's ideal for subheadings and pull quotes where content becomes more interpretive or editorial. It bridges authority and accessibility.

**Albert Sans** carries the body text and all UI. Clean, geometric, highly legible at small sizes — the "sleek and fun" part of the personality. When users are reading, scrolling, and interacting, this is the font doing the work.

### Emphasis & Style

Use italic IBM Plex Serif for emphasis within headlines — as seen in the sign-up screen's *"understood."* This is a signature typographic move: the italic serif within a bold serif headline creates a moment of elegance that reinforces the brand's classy register.

### Typography Rules

**Do:**
- Maintain the hierarchy strictly: serifs for display, sans-serif for body and UI
- Keep body text left-aligned; center-align only for hero moments and CTAs
- Use generous whitespace around headlines — let the serifs breathe
- Use ALL CAPS sparingly: badges, short labels, button text (4 words max)

**Don't:**
- Use IBM Plex Serif for body paragraphs — it's a display face at our sizes
- Use Albert Sans for headlines — it loses the authoritative voice
- Mix more than two type families on a single screen
- Go below 16px for any user-facing readable text (accessibility baseline)
- Use letter-spacing on serif fonts — it breaks their rhythm

---

## 5. UI Components

### Buttons

#### Primary Button (CTA / Social Auth)
- **Shape:** Fully rounded pill (`border-radius: 9999px`)
- **Fill:** White (`#FFFFFF`)
- **Text:** Black (`#000000`), Albert Sans Medium, 16px
- **Height:** 48–52px
- **Width:** Full-width within content container, min horizontal padding 24px
- **Icon placement:** Left-aligned with 12px gap to text (for social auth icons like Google, Apple)

#### Secondary Button (Text Action)
- **Shape:** No background, no border
- **Text:** White (`#FFFFFF`), Albert Sans Medium, 16px
- **Interaction:** Underline on hover/press
- **Usage:** "I already have an account," tertiary navigation actions

#### Content Type Button (Badge-style)
- **Shape:** Rounded rectangle (`border-radius: 8px`)
- **Fill:** Content type color (see Color System)
- **Text:** White, Albert Sans Medium, 12px, uppercase, `letter-spacing: 0.5px`
- **Padding:** 4px 12px
- **Usage:** BILL, ORDER, CASE, GENERAL labels on feed cards

#### Button States

| State | Primary (White Pill) | Secondary (Text) | Badge |
|-------|---------------------|-------------------|-------|
| Default | White fill, black text | White text | Type color fill |
| Pressed | Scale 0.98, opacity 90% | Opacity 70% | Opacity 80% |
| Disabled | Opacity 40% | Opacity 40% | Opacity 40% |
| Loading | Pulse animation or spinner | — | — |

#### Button Rules

**Do:**
- Keep labels short and action-oriented: "Continue," "Explore," "Read More," "Read Full Text"
- Use pill shape consistently for all primary actions
- Ensure minimum 48px touch target on mobile

**Don't:**
- Use sharp-cornered rectangles for primary actions — pills are a brand signature
- Stack more than 3 buttons vertically without visual grouping
- Use colored fills for primary CTA buttons — white on dark is the pattern
- Put gradient fills on buttons

### Cards

#### Content Card (Feed Item)
- **Background:** Slate (`#272D3C`)
- **Corner radius:** 14–16px
- **Padding:** 16–24px
- **Border:** 1px `rgba(255, 255, 255, 0.06)` or subtle shadow for separation
- **Content structure:** Content type badge (top), headline in Inria Serif, preview text in Albert Sans, metadata (source, date) in secondary color

#### Elevated Card (Modal / Overlay)
- **Background:** Deep Navy (`#16182A`) to Slate gradient, or solid Slate
- **Corner radius:** 16–20px
- **Shadow:** `0 8px 24px rgba(0, 0, 0, 0.4)`
- **Usage:** Sign-up flows, article detail overlays, settings panels

### Navigation

#### Tab Pills (Browse / Filter)
- **Active:** White fill, black text, pill shape
- **Inactive:** Transparent, 1px white/10% border, white text at 60% opacity
- **Border radius:** 9999px (pill)
- **Padding:** 8px 16px
- **Font:** Albert Sans Medium, 14–16px

### Inputs

#### Search / Text Input
- **Background:** Slate (`#272D3C`)
- **Border:** 1px `rgba(255, 255, 255, 0.1)`
- **Border radius:** 12px
- **Padding:** 12px 16px
- **Text:** White, Albert Sans Regular, 16px
- **Placeholder:** `#8A8FA0`
- **Focus state:** Border brightens to White at 30% opacity

### Close / Dismiss
- **Icon:** `×` character or custom icon, White
- **Size:** 24×24px icon, 44×44px touch target
- **Position:** Top-left of modal/overlay screens
- **Style:** No background circle — icon stands alone

### App Icon
- **Shape:** Rounded square (iOS superellipse / Android adaptive icon)
- **Background:** Deep Navy (`#16182A`)
- **Mark:** White "B" monogram centered — the monogram incorporates column/pillar motifs, a visual nod to civic architecture
- **Variants:** Dark background (primary), light background (marketing use)

---

## 6. Content Type Visual System

Each category of political content has a distinct visual identity so users can scan the feed and instantly know what they're looking at:

### Bills (Congressional Legislation)
- **Badge color:** Civic Blue (`#4A7CFF`)
- **Badge text:** BILL
- **Card accent:** Subtle left border or top stripe in Civic Blue
- **Metadata shown:** Bill number (e.g., H.R. 1234), sponsor, status, chamber

### Executive Actions (Government Content)
- **Badge color:** Deep Indigo (`#6366F1`)
- **Badge text:** ORDER / MEMO / PROCLAMATION (varies by type)
- **Card accent:** Subtle left border or top stripe in Indigo
- **Metadata shown:** Type, published date, source

### Court Cases
- **Badge color:** Teal (`#0891B2`)
- **Badge text:** CASE
- **Card accent:** Subtle left border or top stripe in Teal
- **Metadata shown:** Case number, court, status, filed date

### General / News
- **Badge color:** Muted (`#8A8FA0`)
- **Badge text:** NEWS
- **Card accent:** None — muted presentation
- **Metadata shown:** Source, date

---

## 7. Vibe & Aesthetic Direction

### The Feeling

Billion should feel like walking into a beautifully designed civic library that also has great Wi-Fi. Serious enough that you trust it with information about legislation that affects your life. Modern enough that you'd actually choose to spend time there. Sleek enough that opening the app feels like a small pleasure, not a civic duty.

### Visual Principles

**Dark-first, always.** The dark palette isn't a "dark mode" toggle — it's the brand identity. It communicates sophistication, focus, and premium quality. If a light mode is ever introduced, it should feel like a secondary accommodation, not an equal option.

**Depth through layering.** Use the navy-to-slate spectrum to create visual hierarchy through surface elevation, not through color variation. Think of it like architectural planes — a card sits above the background, a modal sits above the card. The eye reads depth, not color.

**Typographic confidence.** Let the serif headlines breathe. Large sizes, generous whitespace, considered placement. The typography should feel like it was set with intention. Headlines are a design element, not just labels.

**Restrained motion.** Animations should be present but never performative. Smooth transitions (200–300ms, ease-out), subtle parallax on content cards, gentle fade-ins. Nothing bounces. Nothing spins. Nothing calls attention to the animation itself.

**Civic, not political.** The visual language borrows from institutional design (columns, serifs, dark palettes) without borrowing from any political party's color coding. The content type colors (blue, indigo, teal) were chosen to avoid red/blue partisan associations.

### Photography & Illustration Direction

When the brand expands to include imagery:

- Prefer documentary-style photography over stock imagery
- People should look engaged — reading, discussing, thinking — never posed or performative
- Architectural imagery (capitol buildings, courthouses, libraries) shot with modern composition and dramatic lighting that matches the dark palette
- Illustrations should be geometric and minimal — think informational graphics, not editorial cartoons
- Avoid imagery that codes as partisan: no party symbols, no protest imagery unless editorially balanced

### Voice in UI

Microcopy should reflect the personality tension:

- **Authoritative:** "Presidential Executive Order #14192 — Signed January 20, 2025"
- **Accessible:** "Here's what this means for your state."
- **Encouraging:** "Want to read the full text? We've got it."

Never condescending. Never dumbing down. Always inviting further exploration. Remember the Bradbury Principle — every screen should have an exit point that leads the user deeper into the source material.

---

## 8. Accessibility

### Contrast Requirements
- Primary text (White on Deep Navy): 15.4:1 — exceeds AAA
- Primary text (White on Slate): 11.9:1 — exceeds AAA
- Secondary text (`#8A8FA0` on Deep Navy): verify ≥ 4.5:1 for AA compliance
- All interactive elements: minimum 3:1 contrast against adjacent colors

### Touch Targets
- Minimum: 44×44px (WCAG standard)
- Recommended: 48×48px for primary actions
- Adequate spacing between adjacent targets (minimum 8px gap)

### Focus States
- Visible focus ring on all interactive elements (keyboard navigation)
- Ring color: White at 50% opacity, 2px width
- Never remove focus indicators

### Text
- Minimum font size: 16px for all user-facing readable text
- Body line height: 1.5× minimum
- No text embedded in images without alt text

---

## 9. Spacing & Layout Tokens

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight gaps, icon padding |
| `sm` | 8px | Inline spacing, badge padding |
| `md` | 16px | Standard element gap, card internal padding |
| `lg` | 24px | Section spacing, generous card padding |
| `xl` | 32px | Major section breaks |
| `2xl` | 48px | Screen-level vertical rhythm |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 6px | Small elements, inline badges |
| `md` | 8px | Content type badges, tab pills |
| `lg` | 14px | Cards, containers, inputs |
| `xl` | 20px | Large modals, overlay screens |
| `pill` | 9999px | Buttons, navigation pills |

### Shadows

| Level | Definition | Usage |
|-------|-----------|-------|
| **Subtle** | `0 2px 8px rgba(0, 0, 0, 0.3)` | Cards resting on base surface |
| **Elevated** | `0 8px 24px rgba(0, 0, 0, 0.4)` | Modals, overlays, popovers |
| **Dramatic** | `0 12px 32px rgba(0, 0, 0, 0.5)` | Hero elements, floating action buttons |

Shadows should be deep and soft — reinforcing the layered dark aesthetic. No colored glows in the standard UI.

### Animation

| Token | Value | Usage |
|-------|-------|-------|
| `duration-fast` | 150ms | Hover states, micro-interactions |
| `duration-normal` | 250ms | Screen transitions, card reveals |
| `duration-slow` | 400ms | Modal open/close, onboarding sequences |
| `easing` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Standard ease-out for all motion |

---

## 10. Design Tokens (Quick Reference)

```
/* Colors — Primary */
--color-deep-navy:      #16182A
--color-slate:          #272D3C
--color-white:          #FFFFFF
--color-black:          #000000

/* Colors — Content Types */
--color-bill:           #4A7CFF
--color-executive:      #6366F1
--color-case:           #0891B2
--color-general:        #8A8FA0

/* Colors — Semantic */
--color-success:        #10B981
--color-warning:        #F59E0B
--color-error:          #EF4444
--color-text-secondary: #8A8FA0

/* Colors — Surface */
--color-gradient:       linear-gradient(180deg, #16182A 0%, #272D3C 100%)
--color-border-subtle:  rgba(255, 255, 255, 0.06)
--color-border-focus:   rgba(255, 255, 255, 0.3)

/* Typography — Families */
--font-display:         'IBM Plex Serif', Georgia, serif
--font-editorial:       'Inria Serif', 'Times New Roman', serif
--font-body:            'Albert Sans', 'Helvetica Neue', Arial, sans-serif

/* Typography — Sizes */
--text-headline:        32px
--text-subheading:      22px
--text-body:            18px
--text-small:           16px
--text-micro:           13px
```

---

## 11. Do's and Don'ts — Master List

### Do

- Lead with the dark palette — it is the brand, not a theme
- Use serif typography for all display and headline content
- Maintain generous whitespace — let content breathe
- Design every content piece with a "dig deeper" exit point (Bradbury Principle)
- Present both sides of every issue with equal visual weight (Dual-Lens Commitment)
- Use content type colors (blue, indigo, teal) consistently for badging
- Keep interactive elements feeling tactile and responsive
- Test all text against WCAG AA contrast requirements
- Use pill-shaped buttons for all primary actions
- Let the serif headlines be a design element — large, confident, well-spaced

### Don't

- Introduce light backgrounds as the default surface — dark is primary
- Use color in any way that accidentally codes as partisan (no red-vs-blue)
- Summarize content so completely that users never explore the source (Bradbury violation)
- Use sharp-cornered rectangles where pills and rounded rects are established
- Crowd screens with too many type sizes — stick to the 5-level scale
- Use IBM Plex Serif for body text or Albert Sans for headlines
- Apply gradient fills to small components (buttons, chips, badges)
- Add colored glows or glassmorphism effects — the aesthetic is solid dark surfaces with depth
- Use stock photography or partisan imagery
- Let the "fun" undermine the "authoritative" — they coexist, but authority leads

---

*This is a living document. As Billion evolves, this guide should expand to cover illustration systems, video content formatting standards, interactive article templates, the political discourse feature, and platform-specific adaptations for iOS, Android, and web.*
