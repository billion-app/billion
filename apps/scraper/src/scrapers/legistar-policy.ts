import type {
  LegistarAgendaItem,
  LegistarAttachment,
  LegistarMatter,
} from "@acme/api/integrations/legistar";

export interface BodyPolicy {
  included: boolean;
  relevanceTier: number;
}

/**
 * San José's active Legistar body list includes internal administration,
 * closed sessions, notices, and generic buckets alongside public decision
 * makers. This explicit allowlist is the first-release editorial boundary.
 */
export const SAN_JOSE_BODY_POLICY: Readonly<Record<number, BodyPolicy>> = {
  // Primary decision makers and standing policy committees.
  138: { included: true, relevanceTier: 1 }, // City Council
  139: { included: true, relevanceTier: 1 }, // Neighborhood Services & Education
  140: { included: true, relevanceTier: 1 }, // Community & Economic Development
  172: { included: true, relevanceTier: 1 }, // Public Safety & Finance
  223: { included: true, relevanceTier: 1 }, // Transportation & Environment
  231: { included: true, relevanceTier: 1 }, // Rules & Open Government

  // High-impact hearings and resident-facing commissions.
  198: { included: true, relevanceTier: 2 }, // Airport Commission
  199: { included: true, relevanceTier: 2 }, // Appeals Hearing Board
  205: { included: true, relevanceTier: 2 }, // Campaign and political practices
  206: { included: true, relevanceTier: 2 }, // Historic Landmarks
  207: { included: true, relevanceTier: 2 }, // Housing & Community Development
  209: { included: true, relevanceTier: 2 }, // Library & Education
  211: { included: true, relevanceTier: 2 }, // Parks & Recreation
  212: { included: true, relevanceTier: 2 }, // Planning Commission
  224: { included: true, relevanceTier: 2 }, // Treatment Plant Advisory
  230: { included: true, relevanceTier: 2 }, // Bicycle/Pedestrian
  237: { included: true, relevanceTier: 2 }, // Planning Director's Hearing
  246: { included: true, relevanceTier: 2 }, // Arena Authority
  254: { included: true, relevanceTier: 2 }, // Measure T Oversight
  265: { included: true, relevanceTier: 2 }, // Climate Advisory

  // Community constituencies and city quality-of-life bodies.
  200: { included: true, relevanceTier: 3 }, // Arts
  201: { included: true, relevanceTier: 3 }, // Civil Service
  203: { included: true, relevanceTier: 3 }, // Salary Setting
  213: { included: true, relevanceTier: 3 }, // Senior Citizens
  214: { included: true, relevanceTier: 3 }, // Youth
  239: { included: true, relevanceTier: 3 }, // Privacy Taskforce
  242: { included: true, relevanceTier: 3 }, // Smart City
  245: { included: true, relevanceTier: 3 }, // Youth Empowerment Alliance
  256: { included: true, relevanceTier: 3 }, // Small Business
};

export function bodyPolicy(sourceBodyId: number): BodyPolicy {
  return (
    SAN_JOSE_BODY_POLICY[sourceBodyId] ?? {
      included: false,
      relevanceTier: 4,
    }
  );
}

const TOPICS: readonly [string, RegExp][] = [
  ["housing-land-use", /housing|zoning|planning|development|land use|permit/i],
  [
    "transportation",
    /transport|traffic|street|parking|bicycle|pedestrian|transit/i,
  ],
  ["public-safety", /police|fire|crime|emergency|public safety/i],
  [
    "budget-finance",
    /budget|appropriation|tax|fee|fiscal|contract|purchase|bond/i,
  ],
  [
    "environment-utilities",
    /climate|environment|water|waste|energy|sewer|utility/i,
  ],
  [
    "community-services",
    /park|library|education|arts|youth|senior|neighborhood/i,
  ],
  [
    "ethics-government",
    /election|campaign|ethic|open government|privacy|audit/i,
  ],
];

export function classifyTopic(matter: LegistarMatter): string {
  const haystack = [
    matter.MatterTitle,
    matter.MatterTypeName,
    matter.MatterRequester,
    matter.MatterNotes,
  ]
    .filter(Boolean)
    .join(" ");
  return TOPICS.find(([, pattern]) => pattern.test(haystack))?.[0] ?? "other";
}

export interface GeographicScope {
  kind: "citywide" | "district" | "place" | "unknown";
  districtNumbers: number[] | null;
  text: string | null;
}

export function inferGeographicScope(
  matter: LegistarMatter,
  item: LegistarAgendaItem,
): GeographicScope {
  const text = [
    matter.MatterTitle,
    matter.MatterNotes,
    item.EventItemTitle,
    item.EventItemActionText,
  ]
    .filter(Boolean)
    .join(" ");
  const districts = [
    ...text.matchAll(/(?:council\s+)?district\s+(?:no\.?\s*)?(1[0]|[1-9])\b/gi),
  ].map((match) => Number(match[1]));
  const districtNumbers = [...new Set(districts)].sort((a, b) => a - b);
  if (districtNumbers.length) {
    return {
      kind: "district",
      districtNumbers,
      text: `Council District ${districtNumbers.join(", ")}`,
    };
  }

  const address = text.match(
    /\b\d{1,6}\s+[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,4}\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Way|Court|Ct\.?)\b/i,
  )?.[0];
  if (address) return { kind: "place", districtNumbers: null, text: address };

  if (/citywide|city-wide|municipal code|annual budget/i.test(text)) {
    return { kind: "citywide", districtNumbers: null, text: "Citywide" };
  }
  return { kind: "unknown", districtNumbers: null, text: null };
}

export type DocumentCategory =
  | "public_comment"
  | "staff_report"
  | "ordinance"
  | "resolution"
  | "fiscal"
  | "presentation"
  | "minutes_order"
  | "reference"
  | "other";

export interface DocumentPolicy {
  category: DocumentCategory;
  processingPolicy: "extract_text" | "link_only";
  isPublicComment: boolean;
}

export function classifyDocument(
  attachment: LegistarAttachment,
): DocumentPolicy {
  const name = `${attachment.MatterAttachmentName} ${attachment.MatterAttachmentDescription ?? ""}`;
  if (
    /letters? from (?:the )?public|public comments?|ecomments?|public correspondence/i.test(
      name,
    )
  ) {
    return {
      category: "public_comment",
      processingPolicy: "link_only",
      isPublicComment: true,
    };
  }
  if (attachment.MatterAttachmentIsMinuteOrder)
    return {
      category: "minutes_order",
      processingPolicy: "extract_text",
      isPublicComment: false,
    };
  if (/ordinance/i.test(name))
    return {
      category: "ordinance",
      processingPolicy: "extract_text",
      isPublicComment: false,
    };
  if (/resolution/i.test(name))
    return {
      category: "resolution",
      processingPolicy: "extract_text",
      isPublicComment: false,
    };
  if (/fiscal|budget|cost|appropriation/i.test(name))
    return {
      category: "fiscal",
      processingPolicy: "extract_text",
      isPublicComment: false,
    };
  if (/memorandum|staff report|recommendation|board letter/i.test(name))
    return {
      category: "staff_report",
      processingPolicy: "extract_text",
      isPublicComment: false,
    };
  if (/presentation/i.test(name))
    return {
      category: "presentation",
      processingPolicy: "extract_text",
      isPublicComment: false,
    };
  if (
    attachment.MatterAttachmentIsHyperlink ||
    /language access|web(?:site|page)|link/i.test(name)
  ) {
    return {
      category: "reference",
      processingPolicy: "link_only",
      isPublicComment: false,
    };
  }
  return {
    category: "other",
    processingPolicy: "extract_text",
    isPublicComment: false,
  };
}

export function isDecisionItem(item: LegistarAgendaItem): boolean {
  if (!item.EventItemMatterId || !item.EventItemTitle?.trim()) return false;
  return !/^(language access instructions|please scroll|call to order|pledge of allegiance|orders of the day|closed session)$/i.test(
    item.EventItemTitle.trim(),
  );
}
