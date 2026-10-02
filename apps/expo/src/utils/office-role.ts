/** Manually authored teaching content, independent of candidate statements. */
export interface OfficeRoleContent {
  id: string;
  title: string;
  serves: string;
  term: string;
  power: string;
  limit: string;
  example: string;
  sources: { label: string; url: string }[];
}
const constitution =
  "https://www.archives.gov/founding-docs/constitution-transcript";
const ca = (article: string) =>
  `https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=CONS&article=${article}`;
export const officeRoles: readonly OfficeRoleContent[] = [
  {
    id: "us-house",
    title: "U.S. House representative",
    serves: "People in a congressional district",
    term: "2 years",
    power:
      "Votes on federal laws, taxes and spending with other members of Congress.",
    limit:
      "One representative cannot make a law alone. Both chambers must pass it and send it to the President, who can veto it. Congress can override a veto with two-thirds votes in both chambers.",
    example:
      "A vote on federal transportation funding can affect money available for roads. A candidate's promise still needs the other steps required to become law.",
    sources: [
      {
        label: "U.S. Constitution · Article I, sections 2, 7–9",
        url: constitution,
      },
    ],
  },
  {
    id: "ca-governor",
    title: "California Governor",
    serves: "People throughout California",
    term: "4 years; maximum 2 terms",
    power:
      "Directs the state's executive branch, proposes a state budget, and signs or vetoes bills passed by the Legislature.",
    limit:
      "The Governor cannot pass a law or budget alone. The Legislature passes bills and the budget; it can override a veto with two-thirds votes in both houses.",
    example:
      "Budget choices can affect state funding for schools. Proposed spending still needs legislative approval; a campaign promise is not an enacted budget.",
    sources: [
      {
        label: "California Constitution · Article V, sections 1–2",
        url: ca("V"),
      },
      {
        label: "California Constitution · Article IV, sections 10, 12",
        url: ca("IV"),
      },
    ],
  },
  {
    id: "boston-council",
    title: "Boston City Councilor",
    serves:
      "Boston residents: district councilors serve a district; at-large councilors serve the whole city",
    term: "2 years",
    power: "Votes with the council on local laws and the city's annual budget.",
    limit:
      "One councilor cannot pass a local law alone. Local laws are decisions of the council as a body, rather than an individual member.",
    example:
      "For example, Boston's checkout-bag ordinance changes which bags stores can offer and requires a charge for bags with handles. These everyday rules come from a local ordinance, not an individual councilor's promise.",
    sources: [
      {
        label: "City of Boston · Council membership and responsibilities",
        url: "https://www.boston.gov/departments/city-council",
      },
      {
        label: "City of Boston · Checkout-bag rules",
        url: "https://content.boston.gov/departments/environment/reducing-plastic-bags-city-boston",
      },
    ],
  },
];
export interface OfficeRoleContext {
  office?: string;
  state?: string;
  districtId?: string;
}
/** Never infer legal authority from a title alone or match a different jurisdiction. */
export function resolveOfficeRole({
  office,
  state,
  districtId,
}: OfficeRoleContext): OfficeRoleContent | undefined {
  const title = office?.trim().toLowerCase();
  const district = districtId?.toLowerCase();
  let id: string | undefined;
  const houseDistrict = district?.match(
    /^ocd-division\/country:us\/state:([a-z]{2})\/cd:(0|[1-9]\d*)$/,
  );
  const states =
    "al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy".split(
      " ",
    );
  if (
    houseDistrict &&
    states.includes(houseDistrict[1] ?? "") &&
    (!state || state.toLowerCase() === houseDistrict[1]) &&
    [
      "u.s. house",
      "u.s. representative",
      "united states representative",
      "u.s. house of representatives",
    ].includes(title ?? "")
  )
    id = "us-house";
  if (
    state === "CA" &&
    district === "ocd-division/country:us/state:ca" &&
    ["governor", "california governor"].includes(title ?? "")
  )
    id = "ca-governor";
  if (
    state === "MA" &&
    district === "ocd-division/country:us/state:ma/place:boston" &&
    ["city council", "city councilor", "boston city council"].includes(
      title ?? "",
    )
  )
    id = "boston-council";
  return officeRoles.find((role) => role.id === id);
}
