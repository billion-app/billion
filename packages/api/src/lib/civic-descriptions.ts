import { and, eq, isNull } from "@acme/db";
import { db } from "@acme/db/client";
import { RoleDescriptionRecord } from "@acme/db/schema";

export async function getRoleDescription(
  role?: string,
  level?: string,
): Promise<string | undefined> {
  if (!role) return undefined;

  // Try exact match with level
  if (level) {
    const [exact] = await db
      .select({ description: RoleDescriptionRecord.description })
      .from(RoleDescriptionRecord)
      .where(
        and(
          eq(RoleDescriptionRecord.role, role),
          eq(RoleDescriptionRecord.level, level),
        ),
      )
      .limit(1);
    if (exact) return exact.description;
  }

  // Fall back to role-only match (level is null)
  const [fallback] = await db
    .select({ description: RoleDescriptionRecord.description })
    .from(RoleDescriptionRecord)
    .where(
      and(
        eq(RoleDescriptionRecord.role, role),
        isNull(RoleDescriptionRecord.level),
      ),
    )
    .limit(1);

  return fallback?.description;
}

export async function saveRoleDescription(
  role: string,
  level: string | null,
  description: string,
  source: "seed" | "ai",
): Promise<void> {
  await db
    .insert(RoleDescriptionRecord)
    .values({
      role,
      level,
      description,
      source,
    })
    .onConflictDoUpdate({
      target: [RoleDescriptionRecord.role, RoleDescriptionRecord.level],
      set: { description, source },
    });
}
