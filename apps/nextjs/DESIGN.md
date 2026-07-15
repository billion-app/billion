---
name: Billion
description: AI civic intelligence — bills, executive orders, and court cases turned into short, source-linked briefs for American voters.
colors:
  deep-navy: "#0E1530"
  slate: "#272D3C"
  surface-highest: "#323848"
  white: "#FFFFFF"
  black: "#000000"
  text-secondary: "#8A8FA0"
  border-subtle: "rgba(255,255,255,0.08)"
  civic-blue: "#4A7CFF"
  deep-indigo: "#6366F1"
  teal: "#0891B2"
  muted-general: "#8A8FA0"
  success: "#10B981"
  warning: "#F59E0B"
  error: "#EF4444"
typography:
  display:
    fontFamily: "IBM Plex Serif, Georgia, serif"
    fontSize: "clamp(2.25rem, 4.5vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inria Serif, Georgia, serif"
    fontSize: "clamp(1.5rem, 2.6vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Albert Sans, Helvetica Neue, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Albert Sans, Helvetica Neue, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.08em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "14px"
  xl: "20px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.black}"
    rounded: "{rounded.pill}"
    padding: "0 28px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.white}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    padding: "0 4px"
  badge-bill:
    backgroundColor: "{colors.civic-blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
  badge-executive:
    backgroundColor: "{colors.deep-indigo}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
  badge-case:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
  card:
    backgroundColor: "{colors.slate}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Billion

## 1. Overview

**Creative North Star: "The Annotated Record"**

Billion should feel like a real public record that someone with real editorial judgment has marked up for you: pen-and-highlighter marginalia over dense legislative text, not a startup dashboard. The base is Deep Navy — institutional, courthouse-at-night, not "dark mode" as a toggle but the brand's actual identity. Depth comes from layering (navy → slate → highest surface), never from decoration. The one thing allowed to feel alive is the moment the page shows raw source text becoming a legible brief — that transformation is the product, and it should be interactive, not merely scroll-scrubbed.

This system explicitly rejects the previous build's invented gold/"old-money" accent, glow effects, and spinning-logo intro — none of that is in the brand's actual identity, and it reads as generic AI-landing-page varnish rather than civic authority. It also rejects glassmorphism-as-decoration, tiny tracked eyebrows repeated over every section, and uniform fade-up reveals applied indiscriminately.

**Key Characteristics:**
- Dark-first always; navy is the brand, not a mode.
- Depth through surface layering (navy/slate/highest), not color variation.
- Serif display for authority, sans-serif for everything read at length or interacted with.
- Exactly one interactive accent color family (the content-type colors), used with intent, never decoratively.
- One well-choreographed signature interaction; everything else is quiet.

## 2. Colors

A near-monochrome navy/slate/white system carries the page; the only saturated colors are the three content-type hues, each reserved for its own category.

### Primary
- **Deep Navy** (`#0E1530`): the default canvas everywhere — body background, header, footer.
- **Slate** (`#272D3C`): elevated surfaces — cards, the interactive demo's container, form fields.
- **Surface Highest** (`#323848`): popovers, nested elements, the topmost layer in the depth stack.

### Secondary — Content-type accents (used only to label content, never as page decoration)
- **Civic Blue** (`#4A7CFF`): Bills. Also the page's single interactive accent — primary link hover, focus rings, the active state inside the signature demo — because bills are the flagship content type.
- **Deep Indigo** (`#6366F1`): Executive actions (orders, memoranda, proclamations).
- **Teal** (`#0891B2`): Court cases.

### Neutral
- **White** (`#FFFFFF`): all primary text on dark surfaces, primary button fill.
- **Black** (`#000000`): text on white-filled buttons only. Never a background — Deep Navy is the dark.
- **Text Secondary** (`#8A8FA0`): captions, metadata, timestamps, placeholder text (verified ≥4.5:1 on both Navy and Slate).
- **Border Subtle** (`rgba(255,255,255,0.08)`): the only border treatment; hairline separators between cards and sections.

### Named Rules
**The Reserved Color Rule.** Civic Blue, Deep Indigo, and Teal exist to answer "what kind of content is this" — a bill, an order, a case. They never appear as ambient page decoration (no glow, no gradient wash, no themed section backgrounds). If a saturated color shows up anywhere that isn't labeling content-type or acting as the one interactive accent, it's wrong.

## 3. Typography

**Display Font:** IBM Plex Serif (Georgia fallback)
**Headline Font:** Inria Serif (Georgia fallback)
**Body/UI Font:** Albert Sans (Helvetica Neue fallback)

**Character:** A deliberate serif-to-sans progression — IBM Plex Serif for institutional weight at the display level, Inria Serif as a warmer editorial voice at the section level, Albert Sans carrying every word the reader actually has to parse or interact with.

### Hierarchy
- **Display** (Bold 700, `clamp(2.25rem, 4.5vw, 4rem)`, 1.15): hero headline only. Max one per page.
- **Headline** (Bold 700, `clamp(1.5rem, 2.6vw, 2rem)`, 1.2): section titles, in Inria Serif.
- **Title** (Bold 700, 1.25rem, 1.15): card/subsection titles, in Inria Serif.
- **Body** (Regular 400, 1.125rem, 1.6, max 65ch): all readable paragraph copy, Albert Sans.
- **Label** (Medium 500, 0.75rem, letter-spacing 0.08em, uppercase): badges and short UI labels only — capped at 3 uses per view, never a per-section eyebrow.

### Named Rules
**The One Serif Moment Rule.** A page shows at most one italic-serif emphasis moment (à la the sign-up screen's *"understood"*). Overusing italic serif turns a signature move into a tic.

## 4. Elevation

Billion is a layered system, not a shadowed one. Depth reads through surface color (navy → slate → highest) and hairline borders first; shadow is reserved for genuinely floating elements (the phone mockups, a modal) where something needs to visually separate from the page behind it.

### Shadow Vocabulary
- **Subtle** (`0 2px 8px rgba(0,0,0,0.3)`): cards resting on the base surface.
- **Elevated** (`0 8px 24px rgba(0,0,0,0.4)`): modals, popovers, floating phone mockups.
- **Dramatic** (`0 12px 32px rgba(0,0,0,0.5)`): hero-level floating elements only.

### Named Rules
**The Earned Shadow Rule.** No glow. Shadows are soft, dark, and directional — never colored, never a "glow" halo around a button or badge.

## 5. Components

### Buttons
- **Shape:** fully rounded pill (`border-radius: 9999px`), the brand's one recurring geometric signature.
- **Primary:** white fill, black text, Albert Sans Medium 16px, 52px height, min 24px horizontal padding. No color fills, no gradients, no glow.
- **Hover / Focus:** opacity/scale only (`scale(1.02)` hover, `scale(0.98)` active) — never a colored glow or shadow bloom.
- **Secondary:** no background or border, white text, underline on hover.

### Badges (content-type)
- **Style:** rounded-rectangle (`8px`), filled with the content-type color, white uppercase Albert Sans Medium 12px, `letter-spacing: 0.08em`, `4px 12px` padding.
- **Rule:** exactly three colors exist for this — Civic Blue / Deep Indigo / Teal — never a fourth invented for the marketing page.

### Cards / Containers
- **Corner Style:** 14–16px.
- **Background:** Slate, occasionally Deep Navy for nested "highest" content.
- **Shadow Strategy:** Subtle (see Elevation) or none — a hairline border is usually enough.
- **Border:** `1px rgba(255,255,255,0.08)`.
- **Internal Padding:** 16–24px.

### Navigation
- Minimal top bar: wordmark left, single "Get Early Access" text link right. No hamburger, no mega-menu — the page is one continuous scroll.

### The Annotated Record (signature component)
The page's one interactive set piece: a real excerpt of legislative text that the visitor can actually interact with (hover/click a clause) to reveal how Billion turns it into a plain-language, source-linked brief — the Bradbury Principle made tangible rather than claimed in copy. This is the only place elaborate motion and interaction budget should be spent.

## 6. Do's and Don'ts

### Do:
- Do keep Deep Navy as the only background across the entire page; use Slate purely for elevation.
- Do reserve Civic Blue / Deep Indigo / Teal strictly for content-type labeling (and Civic Blue as the single interactive accent).
- Do spend the motion budget on one signature, interactive moment rather than spreading identical fade-ups across every section.
- Do provide a full `prefers-reduced-motion` alternative (instant/crossfade) for every animation.
- Do keep body copy at 16px+ with ≥4.5:1 contrast, measure capped at 65–75ch.

### Don't:
- Don't reintroduce the gold/"old-money" accent (`#c4a35a`) or any glow/gradient effect — it isn't part of the brand and reads as generic AI-landing varnish.
- Don't ship a spinning-logo or multi-second intro overlay on every load — if there's an intro moment, it must be sub-second and skippable.
- Don't put a tiny uppercase tracked "eyebrow" above every section — one deliberate label system, not repeated scaffolding.
- Don't apply the same fade-up-on-scroll reveal to every block; vary the choreography to fit what's being revealed.
- Don't use gradient text, glassmorphism as decoration, or colored glows anywhere in the standard UI.
- Don't introduce a fourth saturated color beyond the three content-type hues.
