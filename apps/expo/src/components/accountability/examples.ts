import type {
  ActionRecord,
  ContestIdentity,
  Evidence,
  OfficeEntry,
  Priority,
  ResultRecord,
} from "./model";

const identity: ContestIdentity = {
  electionId: "ca-general-2022-11-08",
  districtId: "ca-statewide-2022",
  officeId: "ca-governor",
  contestId: "ca-general-2022-governor",
};
const results: Evidence = {
  publisher: "California Secretary of State",
  published: "2022-12-16",
  url: "https://elections.cdn.sos.ca.gov/sov/2022-general/sov/19-governor.pdf",
  locator: "Governor · page 21 · statewide totals",
};
const certification: Evidence = {
  publisher: "California Secretary of State",
  published: "2022-12-16",
  url: "https://elections.cdn.sos.ca.gov/sov/2022-general/sov/sov-certificate.pdf",
  locator: "Certificate of the Secretary of State",
};
const inauguration: Evidence = {
  publisher: "Office of the Governor",
  published: "2023-01-06",
  url: "https://www.gov.ca.gov/2023/01/06/governor-newsom-inaugurated-to-second-term-in-celebration-of-californias-values-diverse-communities/",
  locator: "Inauguration to second term",
};
export interface AccountabilityExample {
  label: string;
  synthetic: boolean;
  identity: ContestIdentity;
  candidates: { id: string; name: string }[];
  result: ResultRecord;
  entry?: OfficeEntry;
  extraEvidence: Evidence[];
  priorities: Priority[];
  actions: ActionRecord[];
}
export const historical: AccountabilityExample = {
  label: "California · Governor · November 8, 2022",
  synthetic: false,
  identity,
  candidates: [
    { id: "ca-2022-gov-newsom", name: "Gavin Newsom" },
    { id: "ca-2022-gov-dahle", name: "Brian Dahle" },
  ],
  result: {
    identity,
    stage: "certified",
    disputed: false,
    candidateId: "ca-2022-gov-newsom",
    evidence: results,
  },
  entry: {
    identity,
    candidateId: "ca-2022-gov-newsom",
    personId: "ca-newsom",
    tookOffice: "2023-01-06",
    evidence: inauguration,
  },
  extraEvidence: [certification],
  priorities: [],
  actions: [
    {
      topic: "Housing approvals",
      personId: "ca-newsom",
      officeId: identity.officeId,
      districtId: identity.districtId,
      date: "2023-10-11",
      kind: "decision",
      text: "Signed SB 423 to extend a faster approval process for qualifying housing projects.",
      context: "A faster approval process is not a count of homes built.",
      evidence: {
        publisher: "Office of the Governor",
        published: "2023-10-11",
        url: "https://www.gov.ca.gov/2023/10/11/governor-newsom-signs-package-to-streamline-housing-and-expand-tenant-protections-in-california/",
        locator: "SB 423 signing · Senator Wiener · housing approvals",
      },
    },
  ],
};
const demoIdentity: ContestIdentity = {
  electionId: "fictional-2026",
  districtId: "fictional-district-1",
  officeId: "fictional-council",
  contestId: "fictional-council-1-2026",
};
const demoEvidence: Evidence = {
  publisher: "Fictional example record",
  published: "2027-01-05",
  url: "",
  locator: "Synthetic fixture · no real source",
};
export const synthetic: AccountabilityExample = {
  label: "Fictional town · Council district 1 · 2026",
  synthetic: true,
  identity: demoIdentity,
  candidates: [{ id: "demo-candidate-1", name: "Alex Example" }],
  result: {
    identity: demoIdentity,
    stage: "certified",
    disputed: false,
    candidateId: "demo-candidate-1",
    evidence: demoEvidence,
  },
  entry: {
    identity: demoIdentity,
    candidateId: "demo-candidate-1",
    personId: "demo-person-1",
    tookOffice: "2027-01-05",
    evidence: demoEvidence,
  },
  extraEvidence: [],
  priorities: [
    {
      id: "demo-priority-1",
      topic: "Evening bus service",
      candidateId: "demo-candidate-1",
      date: "2026-09-01",
      text: "Expand evening bus service.",
      evidence: { ...demoEvidence, published: "2026-09-01" },
    },
  ],
  actions: [
    {
      topic: "Evening bus service",
      personId: "demo-person-1",
      officeId: demoIdentity.officeId,
      districtId: demoIdentity.districtId,
      date: "2027-02-10",
      kind: "sponsorship",
      text: "Introduced a proposal to fund evening buses.",
      context:
        "This record does not show that funding passed or service began. The council and transit agency would also need to act.",
      evidence: { ...demoEvidence, published: "2027-02-10" },
    },
  ],
};
export function exampleFor(scenario: string): AccountabilityExample {
  if (scenario === "historical") return historical;
  if (scenario === "priorities-only") return { ...synthetic, actions: [] };
  if (scenario === "sparse")
    return { ...synthetic, priorities: [], actions: [] };
  if (scenario === "disputed")
    return { ...synthetic, result: { ...synthetic.result, disputed: true } };
  if (scenario === "missing")
    return {
      ...synthetic,
      result: { identity: demoIdentity, stage: "missing", disputed: false },
      entry: undefined,
    };
  if (scenario === "preliminary" || scenario === "projected")
    return {
      ...synthetic,
      result: { ...synthetic.result, stage: scenario },
      entry: undefined,
    };
  return synthetic;
}
