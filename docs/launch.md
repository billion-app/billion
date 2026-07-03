# Launch Guide

This is the launch checklist for configuration, especially environment
variables. It complements `.env.example`: `.env.example` is the starter template
for common local setup, while this page says what must be present for a real
production launch.

## Production Surfaces

| Surface                | What it needs                                                               |
| ---------------------- | --------------------------------------------------------------------------- |
| Next.js API / website  | Postgres, auth secret, Resend, civic/API keys                               |
| Expo mobile app        | `EXPO_PUBLIC_API_URL` baked into the native build                           |
| Scraper / data jobs    | Postgres, DeepSeek, source API keys, image generation keys                  |
| App Store / operations | public privacy URL, working feedback inbox, launch data already in Postgres |

## Required For Launch

Set these in the production deployment environment and in any local `.env` used
to run launch verification.

| Variable                | Used by                  | Why it is required                                        |
| ----------------------- | ------------------------ | --------------------------------------------------------- |
| `POSTGRES_URL`          | API, DB package, scraper | Primary Supabase/Postgres database connection             |
| `BETTER_AUTH_SECRET`    | Auth / Next.js API       | Required by Better Auth even if v1 has no account flow    |
| `EXPO_PUBLIC_API_URL`   | Expo app build           | Mobile app API origin; baked into the JS bundle           |
| `RESEND_API_KEY`        | Website, feedback API    | Waitlist contacts and in-app feedback delivery            |
| `DEEPSEEK_API_KEY`      | Scraper, API AI helpers  | Scraper text generation; current scraper fails without it |
| `CONGRESS_API_KEY`      | Scraper                  | Federal bill ingestion from congress.gov                  |
| `BFL_API_KEY`           | Scraper                  | Generated feed images via FLUX.2 Pro                      |
| `GOOGLE_CIVIC_API_KEY`  | API                      | Real voter-info / ballot lookup instead of mock data      |
| `GOOGLE_PLACES_API_KEY` | API, Expo address entry  | Production address autocomplete                           |

`GOOGLE_PLACES_API_KEY` falls back to `GOOGLE_API_KEY` and then
`GOOGLE_CIVIC_API_KEY`, but production should use a dedicated Places key with
API restrictions.

## Strongly Recommended

| Variable                  | Used by                  | Notes                                                                 |
| ------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `OPEN_STATES_API_KEY`     | API / civic enrichment   | California state bills, legislators, voting records                   |
| `VOTE_SMART_API_KEY`      | API / enrichment         | Candidate bios, voting records, state measure pro/con where available |
| `COURTLISTENER_API_KEY`   | Scraper                  | Optional auth token, but avoids low anonymous rate limits             |
| `GOOGLE_API_KEY`          | Scraper, Places fallback | Needed with `GOOGLE_SEARCH_ENGINE_ID` for stock thumbnail fallback    |
| `GOOGLE_SEARCH_ENGINE_ID` | Scraper                  | Google Custom Search engine for article thumbnail fallback            |
| `FEEDBACK_TO_EMAIL`       | Feedback API             | Explicit delivery inbox; defaults to the maintainer email in code     |
| `FEEDBACK_FROM_EMAIL`     | Feedback API             | Verified Resend sender; defaults to Resend onboarding sender          |

## Optional / Operational

| Variable                         | Used by                  | Notes                                                       |
| -------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `AUTH_DISCORD_ID`                | Auth                     | Only needed when Discord sign-in is enabled                 |
| `AUTH_DISCORD_SECRET`            | Auth                     | Only needed when Discord sign-in is enabled                 |
| `AUTH_REDIRECT_PROXY_URL`        | Auth                     | OAuth redirect proxy for preview/local auth flows           |
| `RESEND_WAITLIST_SEGMENT_ID`     | Website waitlist         | Adds waitlist contacts to a Resend segment                  |
| `RESEND_LAUNCH_UPDATES_TOPIC_ID` | Website waitlist         | Opts contacts into a launch-updates topic                   |
| `OPENAI_API_KEY`                 | API AI fallback          | API fallback if DeepSeek is absent; not used by scraper     |
| `GOOGLE_GENERATIVE_AI_API_KEY`   | Scraper PDF extraction   | Optional Gemini vision fallback for PDF-heavy civic sources |
| `BFL_MODEL`                      | Scraper image generation | Defaults to `flux-2-pro`                                    |
| `SCRAPER_FORCE_AI_REGEN`         | Scraper                  | Set `1` to regenerate AI fields despite unchanged hashes    |
| `LLM_INPUT_PRICE`                | Scraper cost reporting   | Optional cost metric override                               |
| `LLM_OUTPUT_PRICE`               | Scraper cost reporting   | Optional cost metric override                               |
| `FLUX_IMAGE_PRICE`               | Scraper cost reporting   | Optional cost metric override                               |
| `GOOGLE_SEARCH_PRICE`            | Scraper cost reporting   | Optional cost metric override                               |

## Not A Launch Blocker

`CA_SOS_API_KEY` is currently unused by the code. The California Secretary of
State election-results path uses keyless public feeds, and the voter-guide
scraper also does not need this key. Do not block launch on it.

## Launch Data Verification

After setting the required scraper keys, run narrow scraper checks before a full
`all` run:

```bash
pnpm db:push
pnpm --filter @acme/scraper run start -- federalregister --concurrency 1
pnpm --filter @acme/scraper run start -- scotus --concurrency 1
pnpm --filter @acme/scraper run start -- congress --concurrency 1
```

Then inspect the persisted text for obvious extraction failures:

```bash
psql "$POSTGRES_URL" -c "select title, length(full_text), left(full_text, 300) from government_content order by updated_at desc limit 5;"
psql "$POSTGRES_URL" -c "select bill_number, length(full_text), left(full_text, 300) from bill order by updated_at desc limit 5;"
psql "$POSTGRES_URL" -c "select case_number, length(full_text), left(full_text, 300) from court_case order by updated_at desc limit 5;"
```

Look for raw HTML, repeated navigation text, broken PDF columns, extremely short
`full_text`, or obvious encoding garbage. Fix scraper extraction before
regenerating AI content.

## Related Docs

- [Civic data source setup](./civic-data-sources.md)
- [Scraper pipeline](./scraper.md)
- [iOS release builds](./ios-release.md)
- [Localtunnel setup](./localtunnel.md)
