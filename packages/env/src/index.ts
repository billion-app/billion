import type { EnvSurface, Requirement, ScraperEnvContract } from "./registry";
import { definitionsFor } from "./registry";

export {
  definitionsFor,
  definitionsForAll,
  envRegistry,
  envSchemas,
  requirementFor,
  surfaces,
} from "./registry";
export type {
  EnvDefinition,
  EnvSurface,
  Requirement,
  ScraperEnvContract,
} from "./registry";

export interface EnvIssue {
  key: string;
  requirement: Requirement;
  message: string;
}

export function validateEnvironment(options: {
  environment: Record<string, string | undefined>;
  surface: EnvSurface;
  scrapers?: readonly string[];
  scraperContracts?: readonly ScraperEnvContract[];
}) {
  const issues: EnvIssue[] = [];
  const statuses = definitionsFor(
    options.surface,
    options.scrapers,
    options.scraperContracts,
  ).map(({ definition, requirement }) => {
    const value = options.environment[definition.key]?.trim();
    if (!value) {
      if (definition.defaultValue !== undefined) {
        return { definition, requirement, state: "default" as const };
      }
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
  });

  if (options.surface === "scraper") {
    const contracts = options.scraperContracts ?? [];
    const selected = options.scrapers?.length
      ? contracts.filter((contract) => options.scrapers?.includes(contract.id))
      : contracts;
    const seen = new Set<string>();
    for (const contract of selected) {
      for (const keys of contract.environment.requiredAny ?? []) {
        const issueKey = [...keys].sort().join("|");
        if (seen.has(issueKey)) continue;
        seen.add(issueKey);
        if (!keys.some((key) => Boolean(options.environment[key]?.trim()))) {
          issues.push({
            key: issueKey,
            requirement: "required",
            message: `one of ${keys.join(", ")} is required but all are missing`,
          });
        }
      }
    }
  }
  return { issues, statuses, success: issues.length === 0 };
}
