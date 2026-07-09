import { z } from "zod/v4";

export const surfaces = [
  "nextjs",
  "expo",
  "scraper",
  "database",
  "social",
] as const;
export type EnvSurface = (typeof surfaces)[number];

export const scraperNames = [
  "federalregister",
  "congress",
  "scotus",
  "vote411",
  "scc-cvig",
  "ca-sos-statements",
  "ca-lao-fiscal",
  "ca-vig-archive",
] as const;
export type ScraperName = (typeof scraperNames)[number];

export type Requirement = "required" | "recommended" | "optional";

export interface EnvDefinition {
  key: string;
  description: string;
  group: string;
  secret: boolean;
  setupUrl?: string;
  example?: string;
  defaultValue?: string;
  requirements: Partial<Record<EnvSurface, Requirement>>;
  scraperRequirements?: Partial<Record<ScraperName, Requirement>>;
  schema: z.ZodType<string>;
}

const string = z.string().trim().min(1, "must not be empty");
const url = z.url("must be a valid URL");
const postgresUrl = string.refine(
  (value) => /^postgres(?:ql)?:\/\//i.test(value),
  "must start with postgres:// or postgresql://",
);
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

const define = (definition: EnvDefinition) => definition;
const scraperCostDefinitions = [
  ["LLM_INPUT_PRICE", "Estimated LLM input price.", "0.10"],
  ["LLM_OUTPUT_PRICE", "Estimated LLM output price.", "0.30"],
  ["FLUX_IMAGE_PRICE", "Estimated price per generated BFL image.", "0.03"],
  [
    "GOOGLE_SEARCH_PRICE",
    "Estimated price per Custom Search request.",
    "0.005",
  ],
] as const;

export const envRegistry = [
  define({
    key: "POSTGRES_URL",
    description:
      "Postgres connection used by the API, auth, DB tools, and DB-writing scrapers.",
    group: "Database",
    secret: true,
    setupUrl:
      "https://supabase.com/docs/guides/database/connecting-to-postgres",
    example: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    requirements: { nextjs: "required", database: "required" },
    scraperRequirements: Object.fromEntries(
      scraperNames
        .filter((name) => name !== "vote411")
        .map((name) => [name, "required"]),
    ) as Partial<Record<ScraperName, Requirement>>,
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
    requirements: { nextjs: "recommended" },
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
    key: "DEEPSEEK_API_KEY",
    description: "DeepSeek key for AI text generation.",
    group: "AI",
    secret: true,
    setupUrl: "https://platform.deepseek.com/api_keys",
    requirements: { nextjs: "optional" },
    scraperRequirements: {
      federalregister: "required",
      congress: "required",
      scotus: "required",
    },
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
    scraperRequirements: { congress: "required" },
    schema: string,
  }),
  define({
    key: "COURTLISTENER_API_KEY",
    description: "CourtListener token for higher SCOTUS request limits.",
    group: "Scraper sources",
    secret: true,
    setupUrl: "https://www.courtlistener.com/sign-in/",
    requirements: {},
    scraperRequirements: { scotus: "recommended" },
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
    defaultValue: "flux-2-pro",
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
    scraperRequirements: { "scc-cvig": "optional" },
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
  define({
    key: "BASE_URL",
    description: "Web origin captured by the social-media agent.",
    group: "Social media",
    secret: false,
    defaultValue: "http://localhost:8081",
    requirements: { social: "optional" },
    schema: url,
  }),
  define({
    key: "GEMINI_API_KEY",
    description: "Google AI Studio key for social caption generation.",
    group: "Social media",
    secret: true,
    setupUrl: "https://aistudio.google.com/app/apikey",
    requirements: { social: "optional" },
    schema: string,
  }),
  define({
    key: "INSTAGRAM_USERNAME",
    description: "Instagram login used only by the posting workflow.",
    group: "Social media",
    secret: true,
    requirements: { social: "optional" },
    schema: string,
  }),
  define({
    key: "INSTAGRAM_PASSWORD",
    description: "Instagram password used only by the posting workflow.",
    group: "Social media",
    secret: true,
    requirements: { social: "optional" },
    schema: string,
  }),
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
  selectedScrapers: readonly ScraperName[] = scraperNames,
): Requirement | null {
  const requirements: Requirement[] = [];
  const surfaceRequirement = definition.requirements[surface];
  if (surfaceRequirement) requirements.push(surfaceRequirement);
  if (surface === "scraper" && definition.scraperRequirements) {
    for (const scraper of selectedScrapers) {
      const requirement = definition.scraperRequirements[scraper];
      if (requirement) requirements.push(requirement);
    }
  }
  return (
    requirements.sort((left, right) => rank[right] - rank[left])[0] ?? null
  );
}

export function definitionsFor(
  surface: EnvSurface,
  selectedScrapers: readonly ScraperName[] = scraperNames,
) {
  return envRegistry
    .map((definition) => ({
      definition,
      requirement: requirementFor(definition, surface, selectedScrapers),
    }))
    .filter(
      (item): item is { definition: EnvDefinition; requirement: Requirement } =>
        item.requirement !== null,
    );
}

export function definitionsForAll() {
  return envRegistry.map((definition) => {
    const requirements = surfaces
      .map((surface) => requirementFor(definition, surface))
      .filter((value): value is Requirement => value !== null);
    return {
      definition,
      requirement:
        requirements.sort((left, right) => rank[right] - rank[left])[0] ??
        "optional",
    };
  });
}
