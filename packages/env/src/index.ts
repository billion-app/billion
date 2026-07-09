import type { EnvSurface, Requirement, ScraperName } from "./registry";
import { definitionsFor } from "./registry";

export {
  definitionsFor,
  definitionsForAll,
  envRegistry,
  envSchemas,
  requirementFor,
  scraperNames,
  surfaces,
} from "./registry";
export type {
  EnvDefinition,
  EnvSurface,
  Requirement,
  ScraperName,
} from "./registry";

export interface EnvIssue {
  key: string;
  requirement: Requirement;
  message: string;
}

export function validateEnvironment(options: {
  environment: Record<string, string | undefined>;
  surface: EnvSurface;
  scrapers?: readonly ScraperName[];
}) {
  const issues: EnvIssue[] = [];
  const statuses = definitionsFor(options.surface, options.scrapers).map(
    ({ definition, requirement }) => {
      const value = options.environment[definition.key]?.trim();
      if (!value) {
        if (requirement === "required") {
          issues.push({
            key: definition.key,
            requirement,
            message: "is required but missing",
          });
        }
        return { definition, requirement, state: "missing" as const };
      }
      const parsed = definition.schema.safeParse(value);
      if (!parsed.success) {
        issues.push({
          key: definition.key,
          requirement,
          message: parsed.error.issues[0]?.message ?? "is invalid",
        });
        return { definition, requirement, state: "invalid" as const };
      }
      return { definition, requirement, state: "configured" as const };
    },
  );
  return { issues, statuses, success: issues.length === 0 };
}
