export type FeedbackFormKind = "bug" | "feature";

const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSec5fSDEY7GWZEubxxb4Gq_uNGknBqpTdmHFHAW3JRZIBLI5A/viewform";

const ROUTE_ENTRY = "entry.1736481134";

const ROUTES: Record<
  FeedbackFormKind,
  { answer: string; detailEntry: string }
> = {
  bug: { answer: "Report a bug", detailEntry: "entry.1085859937" },
  feature: {
    answer: "Request a feature",
    detailEntry: "entry.1748070861",
  },
};

/** Builds a Google Forms URL with the right feedback path and details selected. */
export function buildFeedbackFormUrl(
  kind: FeedbackFormKind,
  details?: string,
): string {
  const route = ROUTES[kind];
  const params = [
    "usp=pp_url",
    `${ROUTE_ENTRY}=${encodeURIComponent(route.answer)}`,
  ];

  if (details?.trim()) {
    params.push(`${route.detailEntry}=${encodeURIComponent(details.trim())}`);
  }

  return `${FEEDBACK_FORM_URL}?${params.join("&")}`;
}
