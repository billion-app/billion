# Parallelize Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parallelize the scraper to process items concurrently within each scraper, run independent AI enrichment steps via `Promise.all`, run all scrapers concurrently, and add a `--concurrency` CLI flag.

**Architecture:** Add `p-limit` as a shared concurrency limiter. Each scraper wraps its item-processing loop with the limiter. Inside `upsertContent`, independent AI calls (summary, article, image search) run in parallel via `Promise.all`. Scrapers themselves run concurrently when `--scraper all`. The White House scraper is refactored to stop calling `generateAISummary` directly, making it consistent with other scrapers.

**Tech Stack:** p-limit, TypeScript, existing Vercel AI SDK + OpenAI SDK

---

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/concurrency.ts` | **Create** | Shared p-limit instance, exported for all scrapers |
| `src/main.ts` | **Modify** | Add `--concurrency` CLI flag, run scrapers concurrently, pass concurrency to scrapers |
| `src/utils/types.ts` | **Modify** | Update `Scraper` interface to accept concurrency option |
| `src/utils/db/operations.ts` | **Modify** | Parallelize AI enrichment (summary + article + image) with `Promise.all` |
| `src/scrapers/whitehouse.ts` | **Modify** | Remove direct `generateAISummary` call, use concurrency limiter |
| `src/scrapers/govtrack.ts` | **Modify** | Use concurrency limiter for item processing |
| `src/scrapers/congress.ts` | **Modify** | Use concurrency limiter for item processing |
| `src/scrapers/scotus.ts` | **Modify** | Use concurrency limiter for item processing |

---

### Task 1: Add p-limit dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install p-limit**

```bash
cd /Users/bryanhu/Developer/current/billion/.worktrees/parallel-scrapers/apps/scraper
pnpm add p-limit
```

- [ ] **Step 2: Verify installation**

```bash
pnpm ls p-limit
```

Expected: p-limit version listed

- [ ] **Step 3: Commit**

```bash
git add package.json ../../pnpm-lock.yaml
git commit -m "feat(scraper): add p-limit dependency for concurrency control"
```

---

### Task 2: Create concurrency module

**Files:**
- Create: `src/utils/concurrency.ts`

- [ ] **Step 1: Create the concurrency module**

```typescript
// src/utils/concurrency.ts
import pLimit from "p-limit";

let itemLimit: ReturnType<typeof pLimit> = pLimit(3);

/**
 * Set the concurrency level for item processing within scrapers.
 * Call this once at startup before any scraper runs.
 */
export function setConcurrency(n: number): void {
  itemLimit = pLimit(n);
}

/**
 * Returns the shared concurrency limiter.
 * Use this to wrap item-processing work in scrapers.
 */
export function getItemLimit(): ReturnType<typeof pLimit> {
  return itemLimit;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/concurrency.ts
git commit -m "feat(scraper): add shared concurrency limiter module"
```

---

### Task 3: Update Scraper interface and CLI

**Files:**
- Modify: `src/utils/types.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Update Scraper interface to accept concurrency**

In `src/utils/types.ts`, change the `Scraper` interface:

```typescript
// Before:
export interface Scraper {
  name: string;
  scrape: () => Promise<void>;
}

// After:
export interface Scraper {
  name: string;
  scrape: () => Promise<void>;
}
```

Actually, we don't need to change the interface — concurrency is set globally via `setConcurrency()` before any scraper runs. The scrapers read it via `getItemLimit()`. No interface change needed.

- [ ] **Step 2: Add --concurrency flag and parallel scraper execution in main.ts**

Replace the full content of `src/main.ts` with:

```typescript
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../../.env") });
dotenv.config({ path: join(__dirname, "../.env") });

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { congress } from "./scrapers/congress.js";
import { govtrack } from "./scrapers/govtrack.js";
import { scotus } from "./scrapers/scotus.js";
import { whitehouse } from "./scrapers/whitehouse.js";
import type { Scraper } from "./utils/types.js";
import { createLogger } from "./utils/log.js";
import { setConcurrency } from "./utils/concurrency.js";

const logger = createLogger("main");

const scrapers: Scraper[] = [govtrack, whitehouse, congress, scotus];
const scraperNames = scrapers.map((s) => s.name);

const argv = await yargs(hideBin(process.argv))
  .command("$0 [scraper]", "Run government data scrapers", (yargs) =>
    yargs
      .positional("scraper", {
        describe: "Which scraper to run",
        choices: [...scraperNames.map((n) => n.toLowerCase().replace(/[.\s]/g, "")), "all"] as const,
        default: "all" as const,
      })
      .option("concurrency", {
        alias: "c",
        describe: "Number of items to process concurrently per scraper",
        type: "number",
        default: 3,
      }),
  )
  .help()
  .parse();

const arg = argv.scraper as string;
const concurrency = argv.concurrency as number;

setConcurrency(concurrency);

async function main() {
  logger.info(`Concurrency: ${concurrency} items per scraper`);

  if (arg === "all") {
    logger.info("Running all scrapers concurrently...");
    const results = await Promise.allSettled(
      scrapers.map((s) => s.scrape()),
    );
    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === "rejected") {
        logger.error(`${scrapers[i]!.name} failed:`, result.reason);
      }
    }
    logger.success("All scrapers completed.");
  } else {
    const scraper = scrapers.find(
      (s) => s.name.toLowerCase().replace(/[.\s]/g, "") === arg,
    );
    if (!scraper) {
      logger.error(`Unknown scraper: "${arg}"`);
      process.exit(1);
    }
    await scraper.scrape();
  }
}

main().catch((error) => {
  logger.error("Error running scrapers", error);
  process.exit(1);
});
```

Key changes:
- Added `--concurrency` / `-c` flag (default 3)
- Call `setConcurrency()` before running scrapers
- `Promise.allSettled` to run all scrapers concurrently (one failure doesn't kill others)

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(scraper): add --concurrency flag and run scrapers concurrently"
```

---

### Task 4: Parallelize AI enrichment in upsertContent

**Files:**
- Modify: `src/utils/db/operations.ts`

- [ ] **Step 1: Parallelize the AI summary, article, and image search**

In `src/utils/db/operations.ts`, replace the Phase 2 AI enrichment block (lines 238-319) with a `Promise.all` approach. The full updated function body from the `// Phase 2` comment onward:

Replace this block (from `// Phase 2: AI enrichment` through the AI update `db.update` call, ending at the closing `} catch` of the AI enrichment try block — lines 237-326):

```typescript
  // Phase 2: AI enrichment — run independent steps in parallel
  try {
    // Build promises for independent AI tasks
    const summaryPromise = (async () => {
      const existingDescription = input.data.description;
      if (existingDescription) return existingDescription;
      if (
        shouldGenerateArticle &&
        (fullText || (input.type === "bill" && input.data.summary))
      ) {
        const summarySource =
          input.type === "bill"
            ? input.data.summary || input.data.fullText || ""
            : fullText!;
        logger.start(`Generating AI summary for ${label}`);
        return generateAISummary(title, summarySource);
      }
      return undefined;
    })();

    const articlePromise = (async () => {
      if (shouldGenerateArticle && hasUsableText) {
        const articleType =
          input.type === "bill"
            ? "bill"
            : input.type === "government_content"
              ? input.data.type
              : "court case";
        logger.start(`Generating AI article for ${label}`);
        const article = await generateAIArticle(title, fullText!, articleType, url);
        incrementAIArticlesGenerated();
        return article;
      }
      if (existing?.hasArticle) {
        logger.debug(`Using existing AI article for ${label}`);
      }
      return undefined;
    })();

    const imagePromise = (async () => {
      if (shouldGenerateImage) {
        try {
          const articleType =
            input.type === "bill"
              ? "bill"
              : input.type === "government_content"
                ? input.data.type
                : "court case";
          logger.start(`Searching for thumbnail for ${label}`);
          const searchQuery = await generateImageSearchKeywords(
            title,
            fullText || "",
            articleType,
          );
          logger.debug(`Image search query: ${searchQuery}`);
          const thumbnailUrl = await getThumbnailImage(searchQuery);
          incrementImagesSearched();
          return thumbnailUrl;
        } catch (error) {
          if (error instanceof AIRateLimitError) throw error;
          logger.warn(`Failed to fetch thumbnail for ${label}: ${error instanceof Error ? error.message : error}`);
          return null;
        }
      }
      if (existing?.hasThumbnail) {
        logger.debug(`Using existing thumbnail for ${label}`);
      }
      return undefined;
    })();

    const [description, aiGeneratedArticle, thumbnailUrl] = await Promise.all([
      summaryPromise,
      articlePromise,
      imagePromise,
    ]);

    const existingDescription = input.data.description;
    const hasNewDescription =
      description !== undefined && description !== existingDescription;
    if (
      hasNewDescription ||
      aiGeneratedArticle !== undefined ||
      thumbnailUrl !== undefined
    ) {
      const { table, idCol } = getUpdateTable(input);
      await db
        .update(table)
        .set({
          ...(hasNewDescription && { description }),
          ...(aiGeneratedArticle !== undefined && { aiGeneratedArticle }),
          ...(thumbnailUrl !== undefined && {
            thumbnailUrl: thumbnailUrl || undefined,
          }),
          updatedAt: new Date(),
        })
        .where(eq(idCol, result.id));
      logger.success(`${label} enriched with AI content`);
    }
  } catch (error) {
    if (error instanceof AIRateLimitError) {
      logger.warn(`AI rate limit hit — ${label} saved without AI content, will retry next run`);
    } else {
      throw error;
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/db/operations.ts
git commit -m "feat(scraper): parallelize AI enrichment steps with Promise.all"
```

---

### Task 5: Fix White House scraper consistency

**Files:**
- Modify: `src/scrapers/whitehouse.ts`

- [ ] **Step 1: Remove direct generateAISummary call and add concurrency limiter**

Replace the full content of `src/scrapers/whitehouse.ts`:

```typescript
import * as cheerio from "cheerio";
import TurndownService from "turndown";

import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { upsertContent } from "../utils/db/operations.js";
import { resetMetrics, printMetricsSummary } from "../utils/db/metrics.js";
import { getItemLimit } from "../utils/concurrency.js";
import type { Scraper } from "../utils/types.js";

const NAME = "White House";
const logger = createLogger(NAME);

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
  logger.info("Starting...");
  resetMetrics();

  const maxArticles = 20;
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

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

    logger.debug(`Found ${collectedLinks.length} article links so far`);

    if (collectedLinks.length < maxArticles) {
      nextPageUrl = $(".wp-block-query-pagination-next").attr("href") || null;
    } else {
      nextPageUrl = null;
    }
  }

  logger.info(`Collected ${collectedLinks.length} articles, now scraping...`);

  const limit = getItemLimit();

  await Promise.allSettled(
    collectedLinks.slice(0, maxArticles).map((articleUrl) =>
      limit(async () => {
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

          let contentType = "News Article";
          if (articleUrl.includes("/fact-sheets/")) {
            contentType = "Fact Sheet";
          } else if (articleUrl.includes("/briefings-statements/")) {
            contentType = "Briefing Statement";
          } else if (articleUrl.includes("/presidential-actions/")) {
            contentType = "Presidential Action";
          }

          await upsertContent({
            type: "government_content",
            data: {
              title: headline,
              type: contentType,
              publishedDate: issuedDate,
              description: undefined,
              fullText: fullTextMarkdown,
              url: articleUrl,
              source: "whitehouse.gov",
            },
          });

          logger.success(`Scraped ${contentType}: ${headline}`);
        } catch (error) {
          logger.error(`Error scraping ${articleUrl}`, error);
        }
      }),
    ),
  );

  logger.success("Completed");
  printMetricsSummary(NAME);
}

export const whitehouse: Scraper = {
  name: NAME,
  scrape,
};
```

Key changes:
- Removed `generateAISummary` import and direct call — `upsertContent` handles it now
- Pass `description: undefined` so `upsertContent` generates the summary
- Wrap item processing in `limit()` from `getItemLimit()`
- Use `Promise.allSettled` with `.map()` instead of sequential `for` loop

- [ ] **Step 2: Commit**

```bash
git add src/scrapers/whitehouse.ts
git commit -m "fix(scraper): move White House AI summary into upsertContent for consistency"
```

---

### Task 6: Parallelize GovTrack scraper items

**Files:**
- Modify: `src/scrapers/govtrack.ts`

- [ ] **Step 1: Add concurrency limiter to item processing loop**

In `src/scrapers/govtrack.ts`, add the import at the top (after existing imports):

```typescript
import { getItemLimit } from "../utils/concurrency.js";
```

Then replace the sequential `for` loop (lines 47-126) with:

```typescript
  const limit = getItemLimit();

  await Promise.allSettled(
    textUrls.map((textUrl) =>
      limit(async () => {
        try {
          const res = await fetchWithRetry(textUrl, { timeoutMs: 60_000 });
          const html = await res.text();
          const $ = cheerio.load(html);

          $("#main_text_content script, #main_text_content style, #main_text_content nav").remove();
          let fullText = $("#main_text_content").text().trim();

          if (
            /[A-Z]:\\/.test(fullText) ||
            fullText.startsWith("Examples:") ||
            fullText.startsWith("IB ")
          ) {
            logger.warn(`Rejecting garbage text for ${textUrl}`);
            fullText = "";
          }

          if (fullText) {
            const words = fullText.split(/\s+/);
            if (words.length > 1000) {
              fullText = words.slice(0, 1000).join(" ");
            }
          }

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

          logger.success(`Scraped: ${billNumber} — ${title}`);
        } catch (error) {
          logger.error(`Error scraping ${textUrl}`, error);
        }
      }),
    ),
  );
```

- [ ] **Step 2: Commit**

```bash
git add src/scrapers/govtrack.ts
git commit -m "feat(scraper): parallelize GovTrack item processing"
```

---

### Task 7: Parallelize Congress scraper items

**Files:**
- Modify: `src/scrapers/congress.ts`

- [ ] **Step 1: Add concurrency limiter to item processing loop**

In `src/scrapers/congress.ts`, add the import:

```typescript
import { getItemLimit } from "../utils/concurrency.js";
```

Then replace the sequential `for (const item of bills)` loop (lines 242-297) with:

```typescript
  const limit = getItemLimit();

  await Promise.allSettled(
    bills.map((item) =>
      limit(async () => {
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

          logger.success(`Processed: ${formattedBillNumber} — ${title}`);
        } catch (error) {
          logger.error(`Error processing bill ${item.type}${item.number}`, error);
        }
      }),
    ),
  );
```

- [ ] **Step 2: Commit**

```bash
git add src/scrapers/congress.ts
git commit -m "feat(scraper): parallelize Congress item processing"
```

---

### Task 8: Parallelize SCOTUS scraper items

**Files:**
- Modify: `src/scrapers/scotus.ts`

- [ ] **Step 1: Add concurrency limiter to item processing loop**

In `src/scrapers/scotus.ts`, add the import:

```typescript
import { getItemLimit } from "../utils/concurrency.js";
```

Then replace the sequential `for (const cluster of clusters)` loop (lines 168-209) with:

```typescript
  const limit = getItemLimit();

  await Promise.allSettled(
    clusters.map((cluster) =>
      limit(async () => {
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

          logger.success(`Processed: ${docketNumber} — ${title}`);
        } catch (error) {
          logger.error(`Error processing cluster ${cluster.id}`, error);
        }
      }),
    ),
  );
```

- [ ] **Step 2: Commit**

```bash
git add src/scrapers/scotus.ts
git commit -m "feat(scraper): parallelize SCOTUS item processing"
```

---

### Task 9: Metrics isolation for concurrent scrapers

**Files:**
- Modify: `src/utils/db/metrics.ts`
- Modify: `src/scrapers/govtrack.ts`
- Modify: `src/scrapers/whitehouse.ts`
- Modify: `src/scrapers/congress.ts`
- Modify: `src/scrapers/scotus.ts`

When scrapers run concurrently, they all share the same global metrics and call `resetMetrics()` at start. This means scraper B's `resetMetrics()` wipes scraper A's in-progress counters. Fix: remove `resetMetrics()` from individual scrapers and call it once in `main.ts`, and have `printMetricsSummary` print cumulative metrics at the end.

- [ ] **Step 1: Move resetMetrics to main.ts and print once at end**

In `src/main.ts`, add imports:

```typescript
import { resetMetrics, printMetricsSummary } from "./utils/db/metrics.js";
```

Then update the `main()` function body:

```typescript
async function main() {
  logger.info(`Concurrency: ${concurrency} items per scraper`);
  resetMetrics();

  if (arg === "all") {
    logger.info("Running all scrapers concurrently...");
    const results = await Promise.allSettled(
      scrapers.map((s) => s.scrape()),
    );
    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === "rejected") {
        logger.error(`${scrapers[i]!.name} failed:`, result.reason);
      }
    }
    logger.success("All scrapers completed.");
    printMetricsSummary("All Scrapers");
  } else {
    const scraper = scrapers.find(
      (s) => s.name.toLowerCase().replace(/[.\s]/g, "") === arg,
    );
    if (!scraper) {
      logger.error(`Unknown scraper: "${arg}"`);
      process.exit(1);
    }
    await scraper.scrape();
  }
}
```

- [ ] **Step 2: Remove resetMetrics and printMetricsSummary from each scraper**

In each of the 4 scraper files, remove:
- The `resetMetrics` and `printMetricsSummary` imports
- The `resetMetrics()` call at the start of `scrape()`
- The `printMetricsSummary(NAME)` call at the end of `scrape()`

For **govtrack.ts**: remove `import { printMetricsSummary, resetMetrics } from "../utils/db/metrics.js";`, remove `resetMetrics();` (line 21), remove `printMetricsSummary(NAME);` (line 129).

For **whitehouse.ts**: remove `import { resetMetrics, printMetricsSummary } from "../utils/db/metrics.js";`, remove `resetMetrics();`, remove `printMetricsSummary(NAME);`.

For **congress.ts**: remove `import { printMetricsSummary, resetMetrics } from "../utils/db/metrics.js";`, remove `resetMetrics();`, remove `printMetricsSummary(NAME);`.

For **scotus.ts**: remove `import { printMetricsSummary, resetMetrics } from "../utils/db/metrics.js";`, remove `resetMetrics();`, remove `printMetricsSummary(displayName);`.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts src/scrapers/govtrack.ts src/scrapers/whitehouse.ts src/scrapers/congress.ts src/scrapers/scotus.ts
git commit -m "fix(scraper): centralize metrics reset to avoid race conditions between concurrent scrapers"
```

---

### Task 10: Verify TypeScript compilation

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript compiler**

```bash
cd /Users/bryanhu/Developer/current/billion/.worktrees/parallel-scrapers/apps/scraper
pnpm build
```

Expected: No errors

- [ ] **Step 2: Fix any type errors if found**

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(scraper): resolve type errors from parallelization"
```

(Skip this step if no fixes were needed.)
