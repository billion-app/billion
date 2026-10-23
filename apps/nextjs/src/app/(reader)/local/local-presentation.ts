import { z } from "zod/v4";

export const cityKey = z.enum(["sanjose", "santaclara"]);
export const localFilters = z.object({
  timeline: z.enum(["upcoming", "recent", "all"]).catch("upcoming"),
  topic: z.string().max(80).catch("").default(""),
  offset: z.coerce.number().int().min(0).max(10_000).catch(0),
});
export const topics = [
  ["housing-land-use", "Housing & land use"],
  ["transportation", "Transportation"],
  ["public-safety", "Public safety"],
  ["budget-finance", "Budget, fees & contracts"],
  ["environment-utilities", "Environment & utilities"],
  ["community-services", "Neighborhood services"],
  ["ethics-government", "Ethics & open government"],
  ["other", "Other"],
];

export function meetingDate(value: Date | string | null) {
  if (!value) return "Date not published";
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "America/Los_Angeles",
    }).format(new Date(value)) + " Pacific"
  );
}

export function localListHref(
  city: string,
  filters: z.infer<typeof localFilters>,
) {
  const query = new URLSearchParams({ timeline: filters.timeline });
  if (filters.topic) query.set("topic", filters.topic);
  if (filters.offset) query.set("offset", String(filters.offset));
  return `/local/${city}?${query}`;
}
