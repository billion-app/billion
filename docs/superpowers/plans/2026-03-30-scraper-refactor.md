# Scraper Architecture Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Crawlee with hand-rolled fetch+cheerio, unify the three upsert functions into one, add a shared `fetchWithRetry` utility and `log` helper, and simplify the runner in `main.ts`.

**Architecture:** Each scraper becomes a plain `{ name, scrape }` object using `fetchWithRetry()` + cheerio/turndown directly. A unified `upsertContent(type, data)` replaces the three per-table upsert functions. `main.ts` becomes a loop over selected scrapers.

**Tech Stack:** Node.js, TypeScript, cheerio, turndown, Drizzle ORM, Vercel AI SDK, OpenAI SDK

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/utils/fetch.ts` | `fetchWithRetry()` — shared retry + timeout wrapper |
| Create | `src/utils/log.ts` | `log(scraper, msg)` — prefixed logging |
| Modify | `src/utils/db/operations.ts` | Merge 3 upsert fns → `upsertContent()` |
| Modify | `src/scrapers/govtrack.ts` | Replace CheerioCrawler with fetch+cheerio |
| Modify | `src/scrapers/whitehouse.ts` | Replace CheerioCrawler with fetch+cheerio+turndown |
| Modify | `src/scrapers/congress.ts` | Use shared `fetchWithRetry`, use `upsertContent`, use `log` |
| Modify | `src/scrapers/scotus.ts` | Use shared `fetchWithRetry`, use `upsertContent`, use `log` |
| Modify | `src/main.ts` | Scraper runner loop |
| Modify | `src/utils/types.ts` | Add `Scraper` type, add `ContentType` union |
| Modify | `package.json` | Remove crawlee, playwright, @apify/tsconfig |
| Modify | `tsconfig.json` | Extend monorepo base only (remove apify dep) |
| Modify | `Dockerfile.scraper` (repo root) | Remove playwright install, simplify |

---

### Task 1: Create `fetchWithRetry` utility

**Files:**
- Create: `apps/scraper/src/utils/fetch.ts`

- [ ] **Step 1: Create `fetchWithRetry`**

```ts
// apps/scraper/src/utils/fetch.ts

export interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  timeoutMs?: number;
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const { maxRetries = 3, timeoutMs = 30_000, ...fetchOptions } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      if (res.ok) return res;

      const isRetriable = res.status === 429 || res.status >= 500;
      if (isRetriable && attempt < maxRetries) {
        let delayMs = 1000 * Math.pow(2, attempt);

        // Honor Retry-After header
        const retryAfter = res.headers.get("Retry-After");
        if (retryAfter) {
          const seconds = Number(retryAfter);
          if (!Number.isNaN(seconds)) {
            delayMs = Math.max(delayMs, seconds * 1000);
          } else {
            const retryDate = Date.parse(retryAfter);
            if (!Number.isNaN(retryDate)) {
              const diff = retryDate - Date.now();
              if (diff > 0) delayMs = Math.max(delayMs, diff);
            }
          }
        }

        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      throw new Error(`HTTP ${res.status}: ${url}`);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
      }
      // Retry network errors
      if (attempt < maxRetries && (err?.code === "ECONNRESET" || err?.code === "ECONNREFUSED")) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(`Failed after ${maxRetries + 1} attempts: ${url}`);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/scraper && npx tsc --noEmit`
Expected: No errors from `fetch.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/scraper/src/utils/fetch.ts
git commit -m "feat(scraper): add fetchWithRetry utility"
```

---

### Task 2: Create `log` utility

**Files:**
- Create: `apps/scraper/src/utils/log.ts`

- [ ] **Step 1: Create `log.ts`**

```ts
// apps/scraper/src/utils/log.ts

function timestamp(): string {
  return new Date().toISOString().slice(11, 19); // HH:MM:SS
}

export function log(scraper: string, message: string): void {
  console.log(`[${timestamp()}] [${scraper}] ${message}`);
}

export function logError(scraper: string, message: string, error?: unknown): void {
  console.error(`[${timestamp()}] [${scraper}] ERROR: ${message}`, error ?? "");
}

export function logWarn(scraper: string, message: string): void {
  console.warn(`[${timestamp()}] [${scraper}] WARN: ${message}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/scraper/src/utils/log.ts
git commit -m "feat(scraper): add log utility with scraper prefix"
```

---

### Task 3: Add `Scraper` type and `ContentType` union

**Files:**
- Modify: `apps/scraper/src/utils/types.ts`

- [ ] **Step 1: Add types to `types.ts`**

Add to the end of the file:

```ts
// Content type union for unified upsert
export type ContentType = "bill" | "government_content" | "court_case";

// Scraper interface for the runner
export interface Scraper {
  name: string;
  scrape: () => Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/scraper/src/utils/types.ts
git commit -m "feat(scraper): add Scraper and ContentType types"
```

---

### Task 4: Unify upsert functions into `upsertContent`

**Files:**
- Modify: `apps/scraper/src/utils/db/operations.ts`

This is the biggest single change. The three functions (`upsertBill`, `upsertGovernmentContent`, `upsertCourtCase`) share ~90% of their logic. We merge them into one `upsertContent(type, data)` that switches on type for the DB-specific parts (which table, which conflict target, which fields to hash, which check function).

- [ ] **Step 1: Refactor `operations.ts`**

Replace the entire file with:

```ts
import { db } from "@acme/db/client";
import { Bill, GovernmentContent, CourtCase } from "@acme/db/schema";
import type {
  BillData,
  GovernmentContentData,
  CourtCaseData,
  ContentType,
} from "../types.js";
import { createContentHash } from "../hash.js";
import { generateAISummary, generateAIArticle } from "../ai/text-generation.js";
import { generateImageSearchKeywords } from "../ai/image-keywords.js";
import { getThumbnailImage } from "../api/google-images.js";
import {
  checkExistingBill,
  checkExistingGovernmentContent,
  checkExistingCourtCase,
} from "./helpers.js";
import {
  incrementTotalProcessed,
  incrementNewEntries,
  incrementExistingUnchanged,
  incrementExistingChanged,
  incrementAIArticlesGenerated,
  incrementImagesSearched,
} from "./metrics.js";
import { generateVideoForContent } from "./video-operations.js";

function isUsableText(text: string | undefined | null): text is string {
  if (!text || text.length < 200) return false;
  if (/[A-Z]:\\/.test(text)) return false;

  const lines = text.split("\n");
  const boilerplateLines = lines.filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed === "" ||
      trimmed.split(/\s+/).length === 1 ||
      (/[a-zA-Z]/.test(trimmed) &&
        trimmed === trimmed.toUpperCase() &&
        trimmed.length > 2)
    );
  });
  if (boilerplateLines.length / lines.length >= 0.3) return false;

  return true;
}

type ContentData =
  | { type: "bill"; data: BillData }
  | { type: "government_content"; data: GovernmentContentData }
  | { type: "court_case"; data: CourtCaseData };

// Identify a content item for logging
function contentLabel(input: ContentData): string {
  switch (input.type) {
    case "bill":
      return `bill ${input.data.billNumber}`;
    case "government_content":
      return `${input.data.type} "${input.data.title}"`;
    case "court_case":
      return `court case ${input.data.caseNumber}`;
  }
}

// Build hash input — only fields that matter for change detection
function hashFields(input: ContentData): string {
  switch (input.type) {
    case "bill":
      return JSON.stringify({
        title: input.data.title,
        description: input.data.description,
        status: input.data.status,
        summary: input.data.summary,
        fullText: input.data.fullText,
      });
    case "government_content":
      return JSON.stringify({
        title: input.data.title,
        description: input.data.description,
        fullText: input.data.fullText,
      });
    case "court_case":
      return JSON.stringify({
        title: input.data.title,
        description: input.data.description,
        status: input.data.status,
        fullText: input.data.fullText,
      });
  }
}

// Check existing record per type
async function checkExisting(input: ContentData) {
  switch (input.type) {
    case "bill":
      return checkExistingBill(
        input.data.billNumber,
        input.data.sourceWebsite,
      );
    case "government_content":
      return checkExistingGovernmentContent(input.data.url);
    case "court_case":
      return checkExistingCourtCase(input.data.caseNumber);
  }
}

export async function upsertContent(input: ContentData) {
  const newContentHash = createContentHash(hashFields(input));
  const existing = await checkExisting(input);
  const label = contentLabel(input);

  incrementTotalProcessed();

  // All content types have these fields
  const fullText = input.data.fullText;
  const title = input.data.title;
  const url = input.data.url;

  // Determine what to generate
  const hasUsableText = isUsableText(fullText);
  let shouldGenerateArticle = false;
  let shouldGenerateImage = false;

  if (!existing) {
    shouldGenerateArticle = hasUsableText;
    shouldGenerateImage = hasUsableText;
    incrementNewEntries();
    console.log(`New ${label} detected`);
  } else if (existing.contentHash !== newContentHash) {
    shouldGenerateArticle = hasUsableText;
    shouldGenerateImage = !existing.hasThumbnail && hasUsableText;
    incrementExistingChanged();
    console.log(`Content changed for ${label}`);
  } else {
    shouldGenerateArticle = false;
    shouldGenerateImage = !existing.hasThumbnail && hasUsableText;
    incrementExistingUnchanged();
    console.log(`No changes for ${label}, skipping AI generation`);
  }

  // Generate AI summary if needed
  let description: string | undefined;
  const existingDescription = input.data.description;

  if (existingDescription) {
    description = existingDescription;
  } else if (shouldGenerateArticle && fullText) {
    const summarySource =
      input.type === "bill"
        ? input.data.summary || input.data.fullText || ""
        : fullText;
    console.log(`Generating AI summary for ${label}`);
    description = await generateAISummary(title, summarySource);
  }

  // Generate AI article
  let aiGeneratedArticle: string | undefined;
  const articleType =
    input.type === "bill"
      ? "bill"
      : input.type === "government_content"
        ? input.data.type
        : "court case";

  if (shouldGenerateArticle && hasUsableText) {
    console.log(`Generating AI article for ${label}`);
    aiGeneratedArticle = await generateAIArticle(title, fullText!, articleType, url);
    incrementAIArticlesGenerated();
  } else if (existing?.hasArticle) {
    console.log(`Using existing AI article for ${label}`);
  }

  // Search for thumbnail
  let thumbnailUrl: string | null | undefined;
  if (shouldGenerateImage) {
    try {
      console.log(`Searching for thumbnail for ${label}`);
      const searchQuery = await generateImageSearchKeywords(
        title,
        fullText || "",
        articleType,
      );
      console.log(`Image search query: ${searchQuery}`);
      thumbnailUrl = await getThumbnailImage(searchQuery);
      incrementImagesSearched();
    } catch (error) {
      console.warn(`Failed to fetch thumbnail for ${label}:`, error);
      thumbnailUrl = null;
    }
  } else if (existing?.hasThumbnail) {
    console.log(`Using existing thumbnail for ${label}`);
  }

  // Type-specific DB upsert
  let result: any;

  if (input.type === "bill") {
    const d = input.data;
    const [row] = await db
      .insert(Bill)
      .values({
        ...d,
        description: description ?? d.description,
        aiGeneratedArticle: aiGeneratedArticle || undefined,
        thumbnailUrl:
          thumbnailUrl === undefined
            ? undefined
            : thumbnailUrl || undefined,
        contentHash: newContentHash,
        versions: [],
      })
      .onConflictDoUpdate({
        target: [Bill.billNumber, Bill.sourceWebsite],
        set: {
          title: d.title,
          description: description ?? d.description,
          sponsor: d.sponsor,
          status: d.status,
          introducedDate: d.introducedDate,
          congress: d.congress,
          chamber: d.chamber,
          summary: d.summary,
          fullText: d.fullText,
          ...(aiGeneratedArticle !== undefined && { aiGeneratedArticle }),
          ...(thumbnailUrl !== undefined && {
            thumbnailUrl: thumbnailUrl || undefined,
          }),
          url: d.url,
          contentHash: newContentHash,
          updatedAt: new Date(),
        },
      })
      .returning();
    result = row;
  } else if (input.type === "government_content") {
    const d = input.data;
    const [row] = await db
      .insert(GovernmentContent)
      .values({
        ...d,
        aiGeneratedArticle: aiGeneratedArticle || undefined,
        thumbnailUrl:
          thumbnailUrl === undefined
            ? undefined
            : thumbnailUrl || undefined,
        contentHash: newContentHash,
        versions: [],
      })
      .onConflictDoUpdate({
        target: GovernmentContent.url,
        set: {
          title: d.title,
          type: d.type,
          publishedDate: d.publishedDate,
          description: d.description,
          fullText: d.fullText,
          ...(aiGeneratedArticle !== undefined && { aiGeneratedArticle }),
          ...(thumbnailUrl !== undefined && {
            thumbnailUrl: thumbnailUrl || undefined,
          }),
          source: d.source,
          contentHash: newContentHash,
          updatedAt: new Date(),
        },
      })
      .returning();
    result = row;
  } else {
    const d = input.data;
    const [row] = await db
      .insert(CourtCase)
      .values({
        ...d,
        description: description ?? d.description,
        aiGeneratedArticle: aiGeneratedArticle || undefined,
        thumbnailUrl:
          thumbnailUrl === undefined
            ? undefined
            : thumbnailUrl || undefined,
        contentHash: newContentHash,
        versions: [],
      })
      .onConflictDoUpdate({
        target: CourtCase.caseNumber,
        set: {
          title: d.title,
          court: d.court,
          filedDate: d.filedDate,
          description: description ?? d.description,
          status: d.status,
          fullText: d.fullText,
          ...(aiGeneratedArticle !== undefined && { aiGeneratedArticle }),
          ...(thumbnailUrl !== undefined && {
            thumbnailUrl: thumbnailUrl || undefined,
          }),
          url: d.url,
          contentHash: newContentHash,
          updatedAt: new Date(),
        },
      })
      .returning();
    result = row;
  }

  console.log(`${label} upserted`);

  // Generate video
  if (result && fullText) {
    const videoSource =
      input.type === "bill"
        ? input.data.sourceWebsite
        : input.type === "government_content"
          ? (input.data.source ?? "whitehouse.gov")
          : input.type === "court_case"
            ? input.data.court
            : "";
    await generateVideoForContent(
      input.type,
      result.id,
      title,
      fullText,
      newContentHash,
      videoSource,
      result.thumbnailUrl,
    );
  }

  return result;
}

// Legacy wrapper for whitehouse scraper's upsertPresidentialAction calls
export async function upsertPresidentialAction(actionData: {
  title: string;
  type: string;
  issuedDate?: Date;
  publishedDate?: Date;
  description?: string;
  fullText?: string;
  url: string;
  source?: string;
}) {
  return upsertContent({
    type: "government_content",
    data: {
      ...actionData,
      publishedDate:
        actionData.publishedDate || actionData.issuedDate || new Date(),
      source: actionData.source || "whitehouse.gov",
    },
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/scraper && npx tsc --noEmit`
Expected: Errors only from scrapers still importing old function names (fixed in later tasks)

- [ ] **Step 3: Commit**

```bash
git add apps/scraper/src/utils/db/operations.ts
git commit -m "refactor(scraper): unify upsertBill/GovernmentContent/CourtCase into upsertContent"
```

---

### Task 5: Rewrite `govtrack.ts` — drop Crawlee

**Files:**
- Modify: `apps/scraper/src/scrapers/govtrack.ts`

- [ ] **Step 1: Rewrite `govtrack.ts`**

Replace the entire file:

```ts
import * as cheerio from "cheerio";

import { fetchWithRetry } from "../utils/fetch.js";
import { log, logError } from "../utils/log.js";
import { upsertContent } from "../utils/db/operations.js";
import { printMetricsSummary, resetMetrics } from "../utils/db/metrics.js";
import type { Scraper } from "../utils/types.js";

const NAME = "GovTrack";

interface GovTrackConfig {
  maxBills?: number;
  congress?: number;
}

async function scrape(config: GovTrackConfig = {}) {
  const { maxBills = 100, congress = 119 } = config;
  log(NAME, "Starting...");
  resetMetrics();

  // Step 1: Fetch listing page and collect bill links
  const listingUrl = "https://www.govtrack.us/congress/bills/#docket";
  const listingRes = await fetchWithRetry(listingUrl);
  const listingHtml = await listingRes.text();
  const $listing = cheerio.load(listingHtml);

  const collectedLinks: string[] = [];
  $listing('.card > .card-body .card-title > a[href*="/congress/bills/"]').each(
    (_, element) => {
      const href = $listing(element).attr("href");
      if (href && /\/congress\/bills\/\d+\/[a-z]+\d+/.test(href)) {
        const fullUrl = href.startsWith("http")
          ? href
          : `https://www.govtrack.us${href}`;
        if (collectedLinks.length < maxBills) {
          collectedLinks.push(fullUrl);
        }
      }
    },
  );

  log(NAME, `Found ${collectedLinks.length} bill links`);

  // Step 2: Scrape each bill's /text page
  const textUrls = collectedLinks.slice(0, maxBills).map((url) => `${url}/text`);
  log(NAME, `Scraping ${textUrls.length} text pages...`);

  for (const textUrl of textUrls) {
    try {
      const res = await fetchWithRetry(textUrl, { timeoutMs: 60_000 });
      const html = await res.text();
      const $ = cheerio.load(html);

      // Remove noise
      $("#main_text_content script, #main_text_content style, #main_text_content nav").remove();
      let fullText = $("#main_text_content").text().trim();

      // Reject garbage text
      if (
        /[A-Z]:\\/.test(fullText) ||
        fullText.startsWith("Examples:") ||
        fullText.startsWith("IB ")
      ) {
        log(NAME, `Rejecting garbage text for ${textUrl}`);
        fullText = "";
      }

      // Truncate to 1,000 words
      if (fullText) {
        const words = fullText.split(/\s+/);
        if (words.length > 1000) {
          fullText = words.slice(0, 1000).join(" ");
        }
      }

      // Extract bill info
      const h1Text = $("#maincontent h1").first().text().trim();
      const h1Parts = h1Text.split(":");
      const billNumber = h1Parts[0]?.trim() || "";
      const title =
        h1Parts.length > 1 ? h1Parts.slice(1).join(":").trim() : h1Text;

      const status = $(".bill-status").first().text().trim() || "Unknown";

      let introducedDate: Date | undefined;
      $("p, div").each((_, element) => {
        const text = $(element).text();
        if (text.includes("Introduced:")) {
          const dateStr = text.replace("Introduced:", "").trim();
          introducedDate = new Date(dateStr);
          return false;
        }
      });

      const congressMatch = textUrl.match(/\/congress\/bills\/(\d+)\//);
      const congressNum = congressMatch
        ? parseInt(congressMatch[1]!)
        : undefined;

      const chamber = billNumber.toLowerCase().startsWith("h.")
        ? "House"
        : "Senate";

      const summary = $(".summary").first().text().trim() || undefined;
      const billUrl = textUrl.replace(/\/text$/, "");

      if (fullText !== "") {
        await upsertContent({
          type: "bill",
          data: {
            billNumber,
            title,
            description: summary,
            sponsor: undefined,
            status,
            introducedDate,
            congress: congressNum,
            chamber,
            summary,
            fullText,
            url: billUrl,
            sourceWebsite: "govtrack" as const,
          },
        });
      }

      log(NAME, `Scraped: ${billNumber} — ${title}`);
    } catch (error) {
      logError(NAME, `Error scraping ${textUrl}`, error);
    }
  }

  log(NAME, "Completed");
  printMetricsSummary(NAME);
}

export const govtrack: Scraper = {
  name: NAME,
  scrape: () => scrape(),
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/scraper && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/scraper/src/scrapers/govtrack.ts
git commit -m "refactor(scraper): rewrite govtrack to use fetch+cheerio, drop Crawlee"
```

---

### Task 6: Rewrite `whitehouse.ts` — drop Crawlee

**Files:**
- Modify: `apps/scraper/src/scrapers/whitehouse.ts`

- [ ] **Step 1: Rewrite `whitehouse.ts`**

Replace the entire file:

```ts
import * as cheerio from "cheerio";
import TurndownService from "turndown";

import { fetchWithRetry } from "../utils/fetch.js";
import { log, logError } from "../utils/log.js";
import { upsertContent } from "../utils/db/operations.js";
import { generateAISummary } from "../utils/ai/text-generation.js";
import { resetMetrics, printMetricsSummary } from "../utils/db/metrics.js";
import type { Scraper } from "../utils/types.js";

const NAME = "White House";

function toTitleCase(text: string): string {
  const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
  const letterCount = (text.match(/[a-zA-Z]/g) || []).length;

  if (letterCount === 0 || uppercaseCount / letterCount < 0.5) {
    return text;
  }

  return text
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace(/^./, (char) => char.toUpperCase());
}

async function scrape() {
  log(NAME, "Starting...");
  resetMetrics();

  const maxArticles = 20;
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  // Step 1: Collect article links from listing pages (with pagination)
  const collectedLinks: string[] = [];
  let nextPageUrl: string | null = "https://www.whitehouse.gov/news/";

  while (nextPageUrl && collectedLinks.length < maxArticles) {
    const res = await fetchWithRetry(nextPageUrl, { timeoutMs: 60_000 });
    const html = await res.text();
    const $ = cheerio.load(html);

    $(".wp-block-post-title > a").each((_, element) => {
      const href = $(element).attr("href");
      if (href && collectedLinks.length < maxArticles) {
        collectedLinks.push(href);
      }
    });

    log(NAME, `Found ${collectedLinks.length} article links so far`);

    if (collectedLinks.length < maxArticles) {
      nextPageUrl = $(".wp-block-query-pagination-next").attr("href") || null;
    } else {
      nextPageUrl = null;
    }
  }

  log(NAME, `Collected ${collectedLinks.length} articles, now scraping...`);

  // Step 2: Scrape each article
  for (const articleUrl of collectedLinks.slice(0, maxArticles)) {
    try {
      const res = await fetchWithRetry(articleUrl, { timeoutMs: 60_000 });
      const html = await res.text();
      const $ = cheerio.load(html);

      let headline = $(".wp-block-whitehouse-topper__headline")
        .first()
        .text()
        .trim();
      if (!headline) {
        headline = $("h1").first().text().trim() || "Untitled Article";
      }
      headline = toTitleCase(headline);

      const dateStr =
        $(".wp-block-post-date > time").first().attr("datetime") ||
        $(".wp-block-post-date > time").first().text().trim();
      const issuedDate = dateStr ? new Date(dateStr) : new Date();

      // Extract content after the first div in .entry-content
      const entryContent = $(".entry-content").first();
      let fullTextMarkdown = "";

      if (entryContent.length > 0) {
        const children = entryContent.children();
        let firstDivIndex = -1;

        children.each((index, element) => {
          if (
            element.tagName.toLowerCase() === "div" &&
            firstDivIndex === -1
          ) {
            firstDivIndex = index;
          }
        });

        let contentHtml = "";
        if (firstDivIndex === -1) {
          contentHtml = entryContent.html() || "";
        } else {
          children.each((index, element) => {
            if (index > firstDivIndex) {
              contentHtml += $.html(element);
            }
          });
        }

        fullTextMarkdown = turndownService.turndown(contentHtml).trim();
      }

      // Determine content type from URL
      let contentType = "News Article";
      if (articleUrl.includes("/fact-sheets/")) {
        contentType = "Fact Sheet";
      } else if (articleUrl.includes("/briefings-statements/")) {
        contentType = "Briefing Statement";
      } else if (articleUrl.includes("/presidential-actions/")) {
        contentType = "Presidential Action";
      }

      log(NAME, `Generating AI summary for: ${headline}`);
      const aiSummary = await generateAISummary(headline, fullTextMarkdown);

      await upsertContent({
        type: "government_content",
        data: {
          title: headline,
          type: contentType,
          publishedDate: issuedDate,
          description: aiSummary,
          fullText: fullTextMarkdown,
          url: articleUrl,
          source: "whitehouse.gov",
        },
      });

      log(NAME, `Scraped ${contentType}: ${headline}`);
    } catch (error) {
      logError(NAME, `Error scraping ${articleUrl}`, error);
    }
  }

  log(NAME, "Completed");
  printMetricsSummary(NAME);
}

export const whitehouse: Scraper = {
  name: NAME,
  scrape,
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/scraper && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/scraper/src/scrapers/whitehouse.ts
git commit -m "refactor(scraper): rewrite whitehouse to use fetch+cheerio+turndown, drop Crawlee"
```

---

### Task 7: Update `congress.ts` — use shared utilities

**Files:**
- Modify: `apps/scraper/src/scrapers/congress.ts`

Replace the local `congressFetch` with `fetchWithRetry`, switch to `upsertContent`, use `log`/`logError`, and export as `Scraper` object.

- [ ] **Step 1: Rewrite `congress.ts`**

Key changes from current code:
1. Replace `congressFetch<T>()` with a wrapper around `fetchWithRetry()` that adds the API key and JSON parsing
2. Replace `upsertBill(...)` calls with `upsertContent({ type: "bill", data: ... })`
3. Replace `console.log`/`console.error` with `log(NAME, ...)` / `logError(NAME, ...)`
4. Export as `Scraper` object instead of bare function

```ts
import { fetchWithRetry } from "../utils/fetch.js";
import { log, logError } from "../utils/log.js";
import { printMetricsSummary, resetMetrics } from "../utils/db/metrics.js";
import { upsertContent } from "../utils/db/operations.js";
import type { Scraper } from "../utils/types.js";

const BASE_URL = "https://api.congress.gov/v3";
const NAME = "Congress.gov";

// ─── Config ──────────────────────────────────────────────────────────────────

interface CongressScraperConfig {
  maxBills?: number;
  congress?: number;
  chamber?: "House" | "Senate";
}

// ─── API response shapes (partial — only what we use) ────────────────────────

interface ApiBillListItem {
  number: string;
  type: string;
  title: string;
  congress: number;
  url: string;
  latestAction?: { text: string; actionDate: string };
}

interface ApiBillDetail {
  bill: {
    number: string;
    type: string;
    title: string;
    congress: number;
    originChamber: string;
    introducedDate?: string;
    sponsors?: Array<{
      firstName: string;
      lastName: string;
      party: string;
      state: string;
    }>;
    latestAction?: { text: string; actionDate: string };
  };
}

interface ApiSummary {
  actionDate: string;
  actionDesc: string;
  text: string;
  updateDate: string;
}

interface ApiTextVersion {
  type: string;
  date: string | null;
  formats: Array<{ type: string; url: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.CONGRESS_API_KEY;
  if (!key) {
    throw new Error(
      "CONGRESS_API_KEY is not set. Sign up at https://api.congress.gov/sign-up/",
    );
  }
  return key;
}

async function congressFetch<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetchWithRetry(url.toString());
  return res.json() as Promise<T>;
}

function ordinalSuffix(n: number): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = Math.abs(n) % 10;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  if (mod10 === 1) return "st";
  if (mod10 === 2) return "nd";
  if (mod10 === 3) return "rd";
  return "th";
}

function billTypeToUrlSlug(type: string): string {
  const slugMap: Record<string, string> = {
    HR: "house-bill",
    S: "senate-bill",
    HJRES: "house-joint-resolution",
    SJRES: "senate-joint-resolution",
    HCONRES: "house-concurrent-resolution",
    SCONRES: "senate-concurrent-resolution",
    HRES: "house-simple-resolution",
    SRES: "senate-simple-resolution",
  };
  return slugMap[type.toUpperCase()] ?? `${type.toLowerCase()}-bill`;
}

function formatBillNumber(type: string, number: string): string {
  const prefixMap: Record<string, string> = {
    HR: "H.R.",
    S: "S.",
    HJRES: "H.J.Res.",
    SJRES: "S.J.Res.",
    HCONRES: "H.Con.Res.",
    SCONRES: "S.Con.Res.",
    HRES: "H.Res.",
    SRES: "S.Res.",
  };
  const prefix = prefixMap[type.toUpperCase()] ?? type;
  return `${prefix} ${number}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function fetchSummary(
  congress: number,
  billType: string,
  billNumber: string,
): Promise<string | undefined> {
  try {
    const data = await congressFetch<{ summaries: ApiSummary[] }>(
      `/bill/${congress}/${billType.toLowerCase()}/${billNumber}/summaries`,
    );
    if (!data.summaries?.length) return undefined;
    const latest = data.summaries[data.summaries.length - 1]!;
    return stripHtml(latest.text).slice(0, 5000);
  } catch {
    return undefined;
  }
}

async function fetchFullText(
  congress: number,
  billType: string,
  billNumber: string,
): Promise<string | undefined> {
  try {
    const data = await congressFetch<{ textVersions: ApiTextVersion[] }>(
      `/bill/${congress}/${billType.toLowerCase()}/${billNumber}/text`,
    );
    if (!data.textVersions?.length) return undefined;

    for (const version of [...data.textVersions].reverse()) {
      const txtFormat = version.formats.find(
        (f) => f.type === "Formatted Text",
      );
      if (!txtFormat) continue;

      const res = await fetchWithRetry(txtFormat.url);
      const rawText = await res.text();
      if (!rawText) continue;

      let text = stripHtml(rawText);
      const words = text.split(/\s+/);
      if (words.length > 1000) {
        text = words.slice(0, 1000).join(" ");
      }
      return text.trim() || undefined;
    }
  } catch {
    // Full text is optional
  }
  return undefined;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function scrape(config: CongressScraperConfig = {}) {
  const { maxBills = 100, congress = 119, chamber = "House" } = config;

  log(NAME, `Starting (congress=${congress}, chamber=${chamber})...`);
  resetMetrics();

  const chamberParam = chamber === "House" ? "house" : "senate";

  // Step 1: fetch bill listing
  const allBills: ApiBillListItem[] = [];
  let offset = 0;
  const pageSize = 250;

  while (allBills.length < maxBills) {
    const remaining = maxBills - allBills.length;
    const limit = Math.min(remaining, pageSize);

    const pageData = await congressFetch<{ bills: ApiBillListItem[] }>(
      `/bill/${congress}`,
      { chamber: chamberParam, limit, offset, sort: "updateDate+desc" },
    );

    const page = pageData.bills ?? [];
    allBills.push(...page);
    if (page.length < limit) break;
    offset += page.length;
  }

  const bills = allBills.slice(0, maxBills);
  log(NAME, `Fetched ${bills.length} bills`);

  // Step 2: enrich each bill
  for (const item of bills) {
    try {
      const billType = item.type.toLowerCase();
      const billNumber = item.number;

      const detailData = await congressFetch<ApiBillDetail>(
        `/bill/${congress}/${billType}/${billNumber}`,
      );
      const detail = detailData.bill;

      const formattedBillNumber = formatBillNumber(detail.type, detail.number);
      const title = (detail.title ?? "Unknown").slice(0, 250);

      const primarySponsor = detail.sponsors?.[0];
      const sponsor = primarySponsor
        ? `${primarySponsor.firstName} ${primarySponsor.lastName} (${primarySponsor.party}-${primarySponsor.state})`.slice(
            0,
            250,
          )
        : undefined;

      const status = (detail.latestAction?.text ?? "Unknown").slice(0, 250);
      const introducedDate = detail.introducedDate
        ? new Date(detail.introducedDate)
        : undefined;
      const chamberValue = (detail.originChamber ?? chamber) as
        | "House"
        | "Senate";
      const billUrl = `https://www.congress.gov/bill/${congress}${ordinalSuffix(congress)}-congress/${billTypeToUrlSlug(detail.type)}/${billNumber}`;

      const summary = await fetchSummary(congress, billType, billNumber);
      const fullText = await fetchFullText(congress, billType, billNumber);

      await upsertContent({
        type: "bill",
        data: {
          billNumber: formattedBillNumber,
          title,
          description: summary,
          sponsor,
          status,
          introducedDate,
          congress,
          chamber: chamberValue,
          summary,
          fullText,
          url: billUrl,
          sourceWebsite: "congress.gov",
        },
      });

      log(NAME, `Processed: ${formattedBillNumber} — ${title}`);
    } catch (error) {
      logError(
        NAME,
        `Error processing bill ${item.type}${item.number}`,
        error,
      );
    }
  }

  log(NAME, "Completed");
  printMetricsSummary(NAME);
}

export const congress: Scraper = {
  name: NAME,
  scrape: () => scrape(),
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/scraper && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/scraper/src/scrapers/congress.ts
git commit -m "refactor(scraper): congress uses shared fetchWithRetry + upsertContent + log"
```

---

### Task 8: Update `scotus.ts` — use shared utilities

**Files:**
- Modify: `apps/scraper/src/scrapers/scotus.ts`

Same pattern as congress: replace local `clFetch` with wrapper around `fetchWithRetry`, switch to `upsertContent`, use `log`/`logError`, export as `Scraper`.

- [ ] **Step 1: Rewrite `scotus.ts`**

```ts
import { fetchWithRetry } from "../utils/fetch.js";
import { log, logError } from "../utils/log.js";
import { printMetricsSummary, resetMetrics } from "../utils/db/metrics.js";
import { upsertContent } from "../utils/db/operations.js";
import type { Scraper } from "../utils/types.js";

const CL_BASE = "https://www.courtlistener.com/api/rest/v4";
const NAME = "SCOTUS";

// ─── Config ──────────────────────────────────────────────────────────────────

interface ScotusScraperConfig {
  maxCases?: number;
  court?: string;
}

// ─── API response shapes ─────────────────────────────────────────────────────

interface ClCluster {
  id: number;
  absolute_url: string;
  case_name: string;
  docket_id: number;
  date_filed: string | null;
  precedential_status: string;
  syllabus: string;
  sub_opinions: string[];
}

interface ClOpinion {
  id: number;
  plain_text: string;
  html: string;
  type: string;
}

interface ClDocket {
  id: number;
  docket_number: string;
  court: string;
  date_filed: string | null;
  case_name: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COURT_NAMES: Record<string, string> = {
  scotus: "Supreme Court of the United States",
  ca1: "1st Circuit Court of Appeals",
  ca2: "2nd Circuit Court of Appeals",
  ca3: "3rd Circuit Court of Appeals",
  ca4: "4th Circuit Court of Appeals",
  ca5: "5th Circuit Court of Appeals",
  ca6: "6th Circuit Court of Appeals",
  ca7: "7th Circuit Court of Appeals",
  ca8: "8th Circuit Court of Appeals",
  ca9: "9th Circuit Court of Appeals",
  ca10: "10th Circuit Court of Appeals",
  ca11: "11th Circuit Court of Appeals",
  cadc: "D.C. Circuit Court of Appeals",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "billion-scraper/1.0 (contact via github)",
  };
  if (process.env.COURTLISTENER_API_KEY) {
    headers["Authorization"] = `Token ${process.env.COURTLISTENER_API_KEY}`;
  }
  return headers;
}

async function clFetch<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(`${CL_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetchWithRetry(url.toString(), {
    headers: clHeaders(),
  });
  return res.json() as Promise<T>;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  return words.length > maxWords ? words.slice(0, maxWords).join(" ") : text;
}

async function fetchOpinionText(
  subOpinionUrls: string[],
): Promise<string | undefined> {
  const fetched: { opinion: ClOpinion; text: string }[] = [];

  for (const url of subOpinionUrls) {
    try {
      const res = await fetchWithRetry(url, { headers: clHeaders() });
      const opinion = (await res.json()) as ClOpinion;
      const text = (
        opinion.plain_text?.trim() || stripHtml(opinion.html ?? "")
      ).trim();
      if (text.length > 0) {
        fetched.push({ opinion, text });
      }
    } catch {
      // Skip failed sub-opinions
    }
  }

  if (fetched.length === 0) return undefined;

  const preferredTypes = new Set(["010combined", "020lead"]);
  fetched.sort((a, b) => {
    const aPref = preferredTypes.has(a.opinion.type) ? 0 : 1;
    const bPref = preferredTypes.has(b.opinion.type) ? 0 : 1;
    return aPref - bPref;
  });

  for (const { text } of fetched) {
    if (text.length > 200) {
      return truncateWords(text, 1000);
    }
  }
  return undefined;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function scrape(config: ScotusScraperConfig = {}) {
  const { maxCases = 50, court = "scotus" } = config;

  const displayName = court === "scotus" ? "SCOTUS" : court.toUpperCase();
  log(displayName, `Starting (court=${court}, maxCases=${maxCases})...`);
  resetMetrics();

  // Step 1: fetch opinion clusters
  const allClusters: ClCluster[] = [];
  let page = 1;
  const pageSize = 100;

  while (allClusters.length < maxCases) {
    const pageData = await clFetch<{
      results: ClCluster[];
      next: string | null;
    }>("/clusters/", {
      court,
      order_by: "-date_filed",
      page_size: pageSize,
      page,
    });

    const results = pageData.results ?? [];
    allClusters.push(...results);
    if (!pageData.next || results.length < pageSize) break;
    page++;
  }

  const clusters = allClusters.slice(0, maxCases);
  log(displayName, `Fetched ${clusters.length} opinion clusters`);

  // Step 2: process each cluster
  for (const cluster of clusters) {
    try {
      const docket = await clFetch<ClDocket>(
        `/dockets/${cluster.docket_id}/`,
      );
      const docketNumber = docket.docket_number || `CL-${cluster.id}`;
      const filedDate = docket.date_filed
        ? new Date(docket.date_filed)
        : undefined;
      const courtCode = docket.court ?? court;
      const courtName = COURT_NAMES[courtCode] ?? courtCode.toUpperCase();

      const title = cluster.case_name?.slice(0, 250) || "Unknown Case";
      const status = cluster.precedential_status || "Unknown";
      const caseUrl = `https://www.courtlistener.com${cluster.absolute_url}`;

      const fullText = await fetchOpinionText(cluster.sub_opinions ?? []);

      const description = cluster.syllabus
        ? stripHtml(cluster.syllabus).slice(0, 1000) || undefined
        : undefined;

      await upsertContent({
        type: "court_case",
        data: {
          caseNumber: docketNumber,
          title,
          court: courtName,
          filedDate,
          description,
          status,
          fullText,
          url: caseUrl,
        },
      });

      log(displayName, `Processed: ${docketNumber} — ${title}`);
    } catch (error) {
      logError(displayName, `Error processing cluster ${cluster.id}`, error);
    }
  }

  log(displayName, "Completed");
  printMetricsSummary(displayName);
}

export const scotus: Scraper = {
  name: NAME,
  scrape: () => scrape(),
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/scraper && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/scraper/src/scrapers/scotus.ts
git commit -m "refactor(scraper): scotus uses shared fetchWithRetry + upsertContent + log"
```

---

### Task 9: Rewrite `main.ts` — runner loop

**Files:**
- Modify: `apps/scraper/src/main.ts`

- [ ] **Step 1: Rewrite `main.ts`**

```ts
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../../.env") });
dotenv.config({ path: join(__dirname, "../.env") });

import { congress } from "./scrapers/congress.js";
import { govtrack } from "./scrapers/govtrack.js";
import { scotus } from "./scrapers/scotus.js";
import { whitehouse } from "./scrapers/whitehouse.js";
import type { Scraper } from "./utils/types.js";

const scrapers: Scraper[] = [govtrack, whitehouse, congress, scotus];

async function main() {
  const arg = process.argv[2]?.toLowerCase();

  if (arg && arg !== "all") {
    const scraper = scrapers.find((s) => s.name.toLowerCase().replace(/[.\s]/g, "") === arg.replace(/[.\s]/g, ""));
    if (!scraper) {
      console.error(
        `Unknown scraper: "${arg}". Available: ${scrapers.map((s) => s.name).join(", ")}, all`,
      );
      process.exit(1);
    }
    await scraper.scrape();
  } else {
    console.log("Running all scrapers...\n");
    for (const scraper of scrapers) {
      await scraper.scrape();
      console.log("\n---\n");
    }
    console.log("All scrapers completed.");
  }
}

main().catch((error) => {
  console.error("Error running scrapers:", error);
  process.exit(1);
});
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/scraper && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/scraper/src/main.ts
git commit -m "refactor(scraper): simplify main.ts to runner loop over Scraper objects"
```

---

### Task 10: Remove Crawlee + Playwright dependencies

**Files:**
- Modify: `apps/scraper/package.json`
- Modify: `apps/scraper/tsconfig.json`

- [ ] **Step 1: Add cheerio dependency, remove crawlee/playwright/@apify/tsconfig**

Run:
```bash
cd apps/scraper && pnpm remove crawlee playwright @apify/tsconfig && pnpm add cheerio
```

- [ ] **Step 2: Update `package.json` description**

In `apps/scraper/package.json`, change the `description` field from `"This is an example of a Crawlee project."` to `"Government data scraper for Billion app"`.

- [ ] **Step 3: Verify tsconfig.json**

The tsconfig extends `../../tooling/typescript/base.json` which is fine — `@apify/tsconfig` was a devDependency, not extended in tsconfig. No tsconfig changes needed.

- [ ] **Step 4: Verify it compiles and all imports resolve**

Run: `cd apps/scraper && npx tsc --noEmit`
Expected: Clean compile, no errors

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/package.json apps/scraper/tsconfig.json pnpm-lock.yaml
git commit -m "chore(scraper): remove crawlee, playwright, @apify/tsconfig; add cheerio"
```

---

### Task 11: Update Dockerfile

**Files:**
- Modify: `Dockerfile.scraper` (repo root)

The Dockerfile no longer needs Playwright. It also gets simpler since we don't need the Crawlee storage directory.

- [ ] **Step 1: Update Dockerfile.scraper**

Replace the entire file:

```dockerfile
# Build context: repo root
FROM node:20-slim AS builder

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/scraper/package.json ./apps/scraper/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY tooling/typescript/package.json ./tooling/typescript/package.json
RUN pnpm install --frozen-lockfile

COPY tooling/typescript ./tooling/typescript
COPY packages/db/src ./packages/db/src
COPY packages/db/tsconfig.json ./packages/db/tsconfig.json
WORKDIR /app/packages/db
RUN pnpm exec tsc --emitDeclarationOnly false --skipLibCheck true && \
    find dist -name "*.js" -exec sed -i "s|from '\./\([^']*\)'|from './\1.js'|g" {} + && \
    find dist -name "*.js" -exec sed -i "s|from \"\./\([^\"]*\)\"|from \"./\1.js\"|g" {} +

COPY apps/scraper/src /app/apps/scraper/src
COPY apps/scraper/tsconfig.json /app/apps/scraper/tsconfig.json
WORKDIR /app/apps/scraper
RUN pnpm run build

# Final image
FROM node:20-slim

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update && apt-get install -y --no-install-recommends procps && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/scraper/package.json ./apps/scraper/package.json
COPY packages/db/package.json ./packages/db/package.json
RUN echo "enable-pre-post-scripts=true" >> .npmrc && pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/scraper/dist ./apps/scraper/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist

# Rewrite db exports to use compiled dist/ instead of src/
RUN node -e " \
  const p = require('./packages/db/package.json'); \
  Object.values(p.exports).forEach(e => { e.default = e.default.replace('./src/', './dist/').replace('.ts', '.js'); }); \
  require('fs').writeFileSync('./packages/db/package.json', JSON.stringify(p, null, 2)); \
"

WORKDIR /app/apps/scraper
CMD ["pnpm", "run", "start:prod"]
```

Note: This is essentially the same Dockerfile — the only real change is that `crawlee` and `playwright` are no longer in `package.json` so they won't be installed. The `.dockerignore` `storage` entry for Crawlee storage is now irrelevant but harmless.

- [ ] **Step 2: Commit**

```bash
git add Dockerfile.scraper
git commit -m "chore(scraper): update Dockerfile after removing Crawlee/Playwright"
```

---

### Task 12: Smoke test

- [ ] **Step 1: Full compile check**

Run: `cd apps/scraper && npx tsc --noEmit`
Expected: Clean compile, zero errors

- [ ] **Step 2: Dry run with a single scraper**

Run: `cd apps/scraper && pnpm run start:dev govtrack`
Expected: Scraper runs, fetches listing page, scrapes bill text pages, logs with `[HH:MM:SS] [GovTrack]` prefix, prints metrics summary. Verify no Crawlee references in output.

- [ ] **Step 3: Verify no Crawlee imports remain**

Run: `grep -r "crawlee" apps/scraper/src/`
Expected: No matches

- [ ] **Step 4: Commit any final fixes if needed**
