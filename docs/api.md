# API

`packages/api` defines the shared tRPC router. Next.js serves it at `/api/trpc`; Expo and browser clients call it over HTTP, while server-rendered web pages can call it in-process. Router types flow to the clients through `AppRouter`, and SuperJSON preserves values such as dates across the HTTP boundary.

## Request path

Follow these files when debugging a request:

1. The client creates typed query options, for example in [Expo's API client](../apps/expo/src/utils/api.tsx).
2. The [Next.js route handler](../apps/nextjs/src/app/api/trpc/[trpc]/route.ts) passes the request to tRPC.
3. [createTRPCContext](../packages/api/src/trpc.ts) reads the Better Auth session from request headers and supplies `session`, `authApi`, and `db`.
4. [appRouter](../packages/api/src/root.ts) selects a procedure from `router/`.
5. The procedure validates input, checks access, then reads stored data or calls a provider through `lib/`.

`publicProcedure` can see a session but does not require one. `protectedProcedure` rejects requests without a session user. It establishes authentication; the procedure still needs to scope reads and writes to that user. User-owned operations should derive the user ID from `ctx.session.user.id`.

The development timing middleware adds a random 100 to 500 ms delay to procedures. Account for that when diagnosing local latency.

## Where to make a change

The root router is the authoritative list. This table describes responsibility rather than copying every procedure signature.

| Router       | Responsibility                                                                          |
| ------------ | --------------------------------------------------------------------------------------- |
| `content`    | Browse, search, detail, featured bills, sponsors, and content saves                     |
| `civic`      | Elections, voter information, representatives, and ballot enrichment                    |
| `places`     | Address autocomplete and address resolution                                             |
| `legistar`   | Stored local decisions, bodies, and ingestion health; also legacy source-format queries |
| `openStates` | Request-time state legislation, legislator, and vote lookups                            |
| `user`       | Preferences, blocked content, settings, profile, and saved articles                     |
| `feedback`   | Public feedback submission with optional session context                                |
| `auth`       | Session access and the protected example procedure                                      |
| `post`       | Legacy sample-post CRUD inherited from the template                                     |
| `video`      | Compatibility endpoint returning an empty feed page                                     |

The protected `user.getPreferences` procedure returns the caller's `user_preference` row, or default topic and content-type arrays when no row exists. `user.setPreferences` replaces both arrays in one upsert. Expo onboarding calls it only when an authenticated session exists. Account-free onboarding preferences stay on the device and do not pass through tRPC.

For Browse and article detail, start in [content.ts](../packages/api/src/router/content.ts). `getByType` reads paginated stored content, `search` searches the corpus, and `getById` assembles the detail response with available derived content. The [architecture tour](architecture.md#follow-a-bill-to-the-screen) traces these back to ingestion.

Detail keeps bill `brief` and court `courtBrief` as separate response fields.
Court output is validated against its own schema and current source hash;
missing, stale, invalid, or unsupported brief versions return `null`. Court
lenses also need the current source hash. Original text and source URLs remain
available independently, and Markdown-only court records retain their fallback.
See [court briefs](article-generation.md#court-briefs) for generation and provenance.

## Civic lookups and caching

The [civic integration](../packages/api/src/lib/civic.ts) calls Google Civic and caches responses in `civic_api_cache`. Keys include a hashed normalized address, endpoint, and parameters. Expiry varies by endpoint. Candidate and measure enrichment also use this cache; inspect their modules before assuming the normalized election tables hold a response.

Civic and Places provide mock responses when keys are absent, which helps local UI development. A populated mock ballot is not evidence that real provider access works. See [provider setup](civic-data-sources.md) and [the integration reference](data-sources-api.md) when testing live data.

[Places](../packages/api/src/lib/places.ts) resolves predictions to a full address. Keep the session token stable across one address entry, including the closing details request, so the provider can group them into one session. When the provider refuses a request, autocomplete returns an empty list instead of an error so the user can still type a full address and look it up.

Local decisions have a separate durable ingestion path. New consumers should use the normalized decision API described in [Local government and Legistar](local-government-legistar.md). The old source-format queries remain during the UI transition.

## Enrichment and AI

[Measure enrichment](measure-enrichment.md) and [candidate enrichment](candidate-enrichment.md) merge evidence by trust tier and retain field-level citations. Candidate biographies come from sources. Measure generation needs supporting source material; a title alone is insufficient.

API-side model selection lives in [ai-provider.ts](../packages/api/src/lib/ai-provider.ts). It exports a nullable `llm`, allowing callers to handle unavailable generation. The scraper has its own provider selection and fallback behavior in [utils/ai/provider.ts](../apps/scraper/src/utils/ai/provider.ts); changing one does not change the other.

## Add or change a procedure

Choose the existing router that owns the behavior. Define runtime input validation, choose public or authenticated access, and keep provider-specific transport and parsing in `lib/`. Register a new router in `root.ts` only when the behavior needs its own group.

Read an adjacent procedure and test for the project's conventions. Check the response from its real caller, including missing data and unauthorized access where relevant. Installed mobile apps may keep calling an old procedure after a server deploy, which is why retired paths such as `video.getInfinite` can remain as compatibility stubs.
