import { z } from "zod/v4";

export const surfaces = ["nextjs", "expo", "scraper", "database"] as const;
export type EnvSurface = (typeof surfaces)[number];

export type Requirement = "required" | "recommended" | "optional";

export interface ScraperEnvContract {
  id: string;
  name: string;
  source: string;
  environment: Partial<Record<Requirement, readonly string[]>> & {
    /** Every group requires at least one configured key. */
    requiredAny?: readonly (readonly string[])[];
  };
}

export interface EnvDefinition {
  key: string;
  description: string;
  group: string;
  secret: boolean;
  setupUrl?: string;
  example?: string;
  defaultValue?: string;
  requirements: Partial<Record<EnvSurface, Requirement>>;
  schema: z.ZodType<string>;
}

const string = z.string().trim().min(1, "must not be empty");
const url = z.url("must be a valid URL");
const postgresUrl = string
  .refine(
    (value) => /^postgres(?:ql)?:\/\//i.test(value),
    "must start with postgres:// or postgresql://",
  )
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return Boolean(parsed.hostname) && !/%(?![0-9a-f]{2})/i.test(value);
    } catch {
      return false;
    }
  }, "must be a valid connection URL; percent-encode special characters in username/password components");
const emailList = string.refine(
  (value) =>
    value
      .split(",")
      .every((email) => z.email().safeParse(email.trim()).success),
  "must be a comma-separated list of email addresses",
);
const positiveNumber = string.refine(
  (value) => Number.isFinite(Number(value)) && Number(value) >= 0,
  "must be a non-negative number",
);
const positiveInteger = string.refine(
  (value) => Number.isInteger(Number(value)) && Number(value) > 0,
  "must be a positive integer",
);

const define = (definition: EnvDefinition) => definition;
const scraperCostDefinitions = [
  ["LLM_INPUT_PRICE", "Estimated DeepSeek V4 Flash input price.", "0.14"],
  ["LLM_OUTPUT_PRICE", "Estimated DeepSeek V4 Flash output price.", "0.28"],
  [
    "VISION_INPUT_PRICE",
    "Estimated Gemini 2.5 Flash vision input price.",
    "0.30",
  ],
  [
    "VISION_OUTPUT_PRICE",
    "Estimated Gemini 2.5 Flash vision output price.",
    "2.50",
  ],
  ["FLUX_IMAGE_PRICE", "Estimated price per generated BFL image.", "0.015"],
  [
    "GOOGLE_SEARCH_PRICE",
    "Estimated price per Custom Search request.",
    "0.005",
  ],
] as const;
const scraperSourceLimitDefinitions = [
  ["FEDERALREGISTER_MAX_ITEMS", "Federal Register documents per run.", "20"],
  ["CONGRESS_MAX_ITEMS", "Congress.gov bills per run.", "100"],
  ["SCOTUS_MAX_ITEMS", "CourtListener opinion clusters per run.", "50"],
  ["SCC_CVIG_MAX_ITEMS", "Santa Clara voter-guide PDFs per run.", "10"],
  ["CA_SOS_MAX_ITEMS", "California SOS office pages per run.", "9"],
  ["NCSBE_MAX_ITEMS", "Current-cycle NCSBE source files per run.", "4"],
] as const;

export const envRegistry = [
  define({
    key: "POSTGRES_URL",
    description:
      "Postgres connection used by the API, auth, DB tools, and DB-writing scrapers. Percent-encode special characters only inside substituted username/password components.",
    group: "Database",
    secret: true,
    setupUrl:
      "https://supabase.com/docs/guides/database/connecting-to-postgres",
    example: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    requirements: { nextjs: "required", database: "required" },
    schema: postgresUrl,
  }),
  define({
    key: "BETTER_AUTH_SECRET",
    description:
      "High-entropy secret used to sign and encrypt Better Auth data.",
    group: "Authentication",
    secret: true,
    setupUrl: "https://www.better-auth.com/docs/installation",
    requirements: { nextjs: "required" },
    schema: string.min(32, "must be at least 32 characters"),
  }),
  define({
    key: "AUTH_DISCORD_ID",
    description: "Discord OAuth application client ID.",
    group: "Authentication",
    secret: false,
    setupUrl: "https://discord.com/developers/applications",
    requirements: { nextjs: "optional" },
    schema: string,
  }),
  define({
    key: "AUTH_DISCORD_SECRET",
    description: "Discord OAuth application client secret.",
    group: "Authentication",
    secret: true,
    setupUrl: "https://discord.com/developers/applications",
    requirements: { nextjs: "optional" },
    schema: string,
  }),
  define({
    key: "RESEND_API_KEY",
    description:
      "Full-access Resend key for waitlist contacts and feedback email.",
    group: "Email",
    secret: true,
    setupUrl: "https://resend.com/docs/dashboard/api-keys/introduction",
    requirements: { nextjs: "recommended" },
    schema: string,
  }),
  define({
    key: "FEEDBACK_TO_EMAIL",
    description: "Comma-separated inboxes that receive in-app feedback.",
    group: "Email",
    secret: false,
    requirements: { nextjs: "recommended" },
    schema: emailList,
  }),
  define({
    key: "FEEDBACK_FROM_EMAIL",
    description:
      "Verified Resend sender, for example Billion <feedback@example.com>.",
    group: "Email",
    secret: false,
    setupUrl: "https://resend.com/docs/dashboard/domains/introduction",
    requirements: { nextjs: "recommended" },
    schema: string,
  }),
  define({
    key: "RESEND_WAITLIST_SEGMENT_ID",
    description: "Optional Resend segment assigned to waitlist contacts.",
    group: "Email",
    secret: false,
    setupUrl: "https://resend.com/docs/dashboard/segments/introduction",
    requirements: { nextjs: "optional" },
    schema: string,
  }),
  define({
    key: "RESEND_LAUNCH_UPDATES_TOPIC_ID",
    description: "Optional Resend topic for launch-update consent.",
    group: "Email",
    secret: false,
    setupUrl: "https://resend.com/docs/knowledge-base/why-use-topics",
    requirements: { nextjs: "optional" },
    schema: string,
  }),
  define({
    key: "RESEND_WAITLIST_CONFIRMATION_FROM_EMAIL",
    description:
      "Verified Resend sender for the immediate waitlist confirmation email.",
    group: "Email",
    secret: false,
    setupUrl: "https://resend.com/docs/dashboard/domains/introduction",
    requirements: { nextjs: "optional" },
    schema: string,
  }),
  define({
    key: "RESEND_TESTFLIGHT_BATCH_SEGMENT_ID",
    description:
      "Optional active TestFlight batch segment assigned to new waitlist contacts.",
    group: "Email",
    secret: false,
    setupUrl: "https://resend.com/docs/dashboard/segments/introduction",
    requirements: { nextjs: "optional" },
    schema: string,
  }),
  define({
    key: "NEXT_PUBLIC_POSTHOG_KEY",
    description: "PostHog project API key used by the Next.js client.",
    group: "Analytics",
    secret: false,
    setupUrl: "https://us.posthog.com/project/settings",
    requirements: { nextjs: "required" },
    schema: string,
  }),
  define({
    key: "NEXT_PUBLIC_POSTHOG_HOST",
    description: "PostHog ingestion host used by the Next.js client.",
    group: "Analytics",
    secret: false,
    example: "https://us.i.posthog.com",
    requirements: { nextjs: "required" },
    schema: url,
  }),
  define({
    key: "POSTHOG_API_KEY",
    description:
      "PostHog personal API key with write access for production source-map uploads.",
    group: "Analytics",
    secret: true,
    setupUrl: "https://us.posthog.com/settings/user-api-keys",
    requirements: { nextjs: "recommended" },
    schema: string,
  }),
  define({
    key: "POSTHOG_PROJECT_ID",
    description: "PostHog project ID used for production source-map uploads.",
    group: "Analytics",
    secret: false,
    example: "489046",
    requirements: { nextjs: "recommended" },
    schema: positiveInteger,
  }),
  define({
    key: "EXPO_PUBLIC_API_URL",
    description:
      "Public HTTPS origin of the Next.js API; compiled into Expo builds.",
    group: "Expo",
    secret: false,
    setupUrl: "https://docs.expo.dev/eas/environment-variables/",
    example: "http://localhost:3000",
    requirements: { expo: "required" },
    schema: url,
  }),
  define({
    key: "GOOGLE_CIVIC_API_KEY",
    description:
      "Google Civic Information API key for real ballot and representative data.",
    group: "Civic data",
    secret: true,
    setupUrl: "https://developers.google.com/civic-information/docs/using_api",
    requirements: { nextjs: "required" },
    schema: string,
  }),
  define({
    key: "GOOGLE_PLACES_API_KEY",
    description:
      "Dedicated Places API (New) key for production address autocomplete.",
    group: "Civic data",
    secret: true,
    setupUrl:
      "https://developers.google.com/maps/documentation/places/web-service/cloud-setup",
    requirements: { nextjs: "recommended" },
    schema: string,
  }),
  define({
    key: "OPEN_STATES_API_KEY",
    description:
      "Open States key for state bills, legislators, and voting records.",
    group: "Civic data",
    secret: true,
    setupUrl: "https://openstates.org/accounts/profile/",
    requirements: { nextjs: "optional" },
    schema: string,
  }),
  define({
    key: "VOTE_SMART_API_KEY",
    description: "Vote Smart key for candidate and state-measure enrichment.",
    group: "Civic data",
    secret: true,
    setupUrl: "https://votesmart.org/share/api",
    requirements: { nextjs: "optional" },
    schema: string,
  }),
  define({
    key: "OPENROUTER_API_KEY",
    description: "Preferred key for AI text generation through OpenRouter.",
    group: "AI",
    secret: true,
    setupUrl: "https://openrouter.ai/settings/keys",
    requirements: { nextjs: "optional" },
    schema: string,
  }),
  define({
    key: "OPENROUTER_MODEL",
    description: "OpenRouter model slug used for AI text generation.",
    group: "AI",
    secret: false,
    defaultValue: "deepseek/deepseek-v4-flash",
    requirements: { nextjs: "optional" },
    schema: string,
  }),
  define({
    key: "DEEPSEEK_API_KEY",
    description:
      "Deprecated direct DeepSeek key; use OPENROUTER_API_KEY for AI text generation.",
    group: "AI",
    secret: true,
    setupUrl: "https://platform.deepseek.com/api_keys",
    requirements: { nextjs: "optional" },
    schema: string,
  }),
  define({
    key: "GROQ_API_KEY",
    description: "Groq key for AI text generation.",
    group: "AI",
    secret: true,
    setupUrl: "https://console.groq.com/keys",
    requirements: { nextjs: "optional" },
    schema: string,
  }),
  define({
    key: "OPENAI_API_KEY",
    description: "Fallback API-side AI key; not used by the scraper.",
    group: "AI",
    secret: true,
    setupUrl: "https://platform.openai.com/api-keys",
    requirements: { nextjs: "optional" },
    schema: string,
  }),
  define({
    key: "CONGRESS_API_KEY",
    description: "Congress.gov API key for federal bill ingestion.",
    group: "Scraper sources",
    secret: true,
    setupUrl: "https://api.congress.gov/sign-up/",
    requirements: {},
    schema: string,
  }),
  define({
    key: "COURTLISTENER_API_KEY",
    description: "CourtListener token for higher SCOTUS request limits.",
    group: "Scraper sources",
    secret: true,
    setupUrl: "https://www.courtlistener.com/sign-in/",
    requirements: {},
    schema: string,
  }),
  define({
    key: "BFL_API_KEY",
    description: "Black Forest Labs key for generated feed-card images.",
    group: "Scraper images",
    secret: true,
    setupUrl: "https://docs.bfl.ai/quick_start/get_started",
    requirements: { scraper: "recommended" },
    schema: string,
  }),
  define({
    key: "BFL_MODEL",
    description: "BFL image model endpoint.",
    group: "Scraper images",
    secret: false,
    defaultValue: "flux-2-klein-9b",
    requirements: { scraper: "optional" },
    schema: string,
  }),
  define({
    key: "GOOGLE_API_KEY",
    description: "Google Custom Search key; also a fallback for Places.",
    group: "Google images",
    secret: true,
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    requirements: { nextjs: "optional", scraper: "optional" },
    schema: string,
  }),
  define({
    key: "GOOGLE_SEARCH_ENGINE_ID",
    description:
      "Programmable Search Engine identifier used with GOOGLE_API_KEY.",
    group: "Google images",
    secret: false,
    setupUrl: "https://programmablesearchengine.google.com/",
    requirements: { scraper: "optional" },
    schema: string,
  }),
  define({
    key: "GOOGLE_GENERATIVE_AI_API_KEY",
    description: "Gemini vision fallback for PDF-heavy scraper sources.",
    group: "Scraper vision",
    secret: true,
    setupUrl: "https://aistudio.google.com/app/apikey",
    requirements: {},
    schema: string,
  }),
  define({
    key: "SCRAPER_FORCE_AI_REGEN",
    description: "Set to 1 only for a deliberate AI regeneration backfill.",
    group: "Scraper operations",
    secret: false,
    defaultValue: "0",
    requirements: { scraper: "optional" },
    schema: z.enum(["0", "1"]),
  }),
  define({
    key: "SCRAPER_MAX_NEW_ITEMS_PER_RUN",
    description:
      "Max brand-new items (per data source) that get AI enrichment in one run; extras roll over to the next run.",
    group: "Scraper operations",
    secret: false,
    defaultValue: "10",
    requirements: { scraper: "optional" },
    schema: positiveNumber,
  }),
  ...scraperSourceLimitDefinitions.map(([key, description, defaultValue]) =>
    define({
      key,
      description,
      group: "Scraper source limits",
      secret: false,
      defaultValue,
      requirements: {},
      schema: positiveInteger,
    }),
  ),
  ...scraperCostDefinitions.map(([key, description, defaultValue]) =>
    define({
      key,
      description,
      group: "Scraper cost reporting",
      secret: false,
      defaultValue,
      requirements: { scraper: "optional" },
      schema: positiveNumber,
    }),
  ),
] satisfies EnvDefinition[];

export const envSchemas = Object.fromEntries(
  envRegistry.map((definition) => [definition.key, definition.schema]),
) as Record<string, z.ZodType<string>>;

const rank: Record<Requirement, number> = {
  optional: 0,
  recommended: 1,
  required: 2,
};

export function requirementFor(
  definition: EnvDefinition,
  surface: EnvSurface,
  selectedScrapers: readonly string[] = [],
  scraperContracts: readonly ScraperEnvContract[] = [],
): Requirement | null {
  const requirements: Requirement[] = [];
  const surfaceRequirement = definition.requirements[surface];
  if (surfaceRequirement) requirements.push(surfaceRequirement);
  if (surface === "scraper") {
    const selected = selectedScrapers.length
      ? scraperContracts.filter((contract) =>
          selectedScrapers.includes(contract.id),
        )
      : scraperContracts;
    for (const contract of selected) {
      for (const requirement of [
        "required",
        "recommended",
        "optional",
      ] as const) {
        if (contract.environment[requirement]?.includes(definition.key)) {
          requirements.push(requirement);
        }
      }
    }
  }
  return (
    requirements.sort((left, right) => rank[right] - rank[left])[0] ?? null
  );
}

export function definitionsFor(
  surface: EnvSurface,
  selectedScrapers: readonly string[] = [],
  scraperContracts: readonly ScraperEnvContract[] = [],
) {
  return envRegistry
    .map((definition) => ({
      definition,
      requirement: requirementFor(
        definition,
        surface,
        selectedScrapers,
        scraperContracts,
      ),
    }))
    .filter(
      (item): item is { definition: EnvDefinition; requirement: Requirement } =>
        item.requirement !== null,
    );
}

export function definitionsForAll(
  scraperContracts: readonly ScraperEnvContract[] = [],
) {
  return envRegistry.map((definition) => {
    const requirements = surfaces
      .map((surface) =>
        requirementFor(definition, surface, [], scraperContracts),
      )
      .filter((value): value is Requirement => value !== null);
    return {
      definition,
      requirement:
        requirements.sort((left, right) => rank[right] - rank[left])[0] ??
        "optional",
    };
  });
}
