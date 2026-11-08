/**
 * Local-only reader fixtures layered on top of `pnpm -F @acme/db seed`.
 *
 * Covers every reader branch: v8 headline + per-change reader follow-ups, each
 * primary visual (temperature, dates, percentage, change map), every terminal
 * status (enacted, vetoed, failed), timelines, featured rails, and a
 * California local rail. All content is fictional. Run the base seed first.
 *
 *   pnpm -F @acme/db exec tsx seed-review.ts
 */
import { createHash } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";

import type { BillBriefRecord } from "@acme/validators";
import { loadRepoEnv } from "@acme/env/load";
import { BillBriefRecordSchema } from "@acme/validators";

loadRepoEnv();

const { clampBillDescription } = await import("./src/bill-description");
const { db } = await import("./src/client");
const { Bill, ContentBrief, ContentLens, FeaturedBill } =
  await import("./src/schema");

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const host = new URL(process.env.POSTGRES_URL ?? "postgres://missing").hostname;
if (!LOCAL_HOSTS.has(host)) {
  throw new Error(`Refusing to write review fixtures into "${host}".`);
}

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const day = (n: number) => daysAgo(n).toISOString().slice(0, 10);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

type Action = { date: string; text: string; type?: string };
type Brief = Omit<BillBriefRecord, "generatedAt" | "modelVersion">;

interface Fixture {
  billNumber: string;
  sourceWebsite: "congress.gov" | "openstates.org";
  /** Existing base-seed bills keep their row; only these fields change. */
  existing?: boolean;
  title?: string;
  description?: string;
  sponsor?: string;
  chamber?: string;
  congress?: number;
  introducedDate?: Date;
  summary?: string;
  fullText: string;
  url?: string;
  thumbnailUrl?: string;
  actions: Action[];
  brief?: Brief;
  lens?: Record<string, unknown>;
  featured?: { order: number; rationale: string };
}

// ── Federal: base-seed bills, upgraded ──────────────────────────────────────

const cleanWaterText =
  "Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled, SECTION 1. SHORT TITLE. This Act may be cited as the 'Clean Water Access Act'. SECTION 2. FINDINGS. Congress finds that millions of Americans lack access to clean, safe drinking water. SECTION 3. LEAD SERVICE LINE REPLACEMENT. Each public water system shall replace all lead service lines under its control not later than 10 years after the date of enactment of this Act. SECTION 4. TESTING IN SCHOOLS. The Administrator shall establish a program to test drinking water for lead at every public school and child care facility. SECTION 5. RATE ASSISTANCE. The Administrator may award grants to States to reduce water bills for low-income households.";

const aiText =
  "Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled, SECTION 1. SHORT TITLE. This Act may be cited as the 'AI Accountability and Transparency Act'. SECTION 2. DEFINITIONS. In this Act: (1) AUTOMATED DECISION SYSTEM means a computational process that makes or substantially supports a decision about employment, housing, credit, education, or health care. SECTION 3. IMPACT ASSESSMENTS. Beginning on January 1, 2027, a covered entity shall complete an impact assessment before deploying an automated decision system. SECTION 4. NOTICE. A covered entity shall notify an individual when an automated decision system is used to make a consequential decision about that individual. SECTION 5. REPORTS. Not later than July 1, 2028, the Commission shall submit to Congress a report summarizing the impact assessments received.";

const housingText =
  "Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled, SECTION 1. SHORT TITLE. This Act may be cited as the 'Affordable Housing Expansion Act'. SECTION 2. LOW-INCOME HOUSING TAX CREDIT. The annual credit ceiling for each State shall be increased by 50 percent. SECTION 3. AFFORDABILITY SET-ASIDE. A project receiving assistance under this section shall reserve not less than 20 percent of units for households earning 60 percent or less of area median income. SECTION 4. ZONING GRANTS. The Secretary shall award grants to local governments that reduce minimum lot sizes or permit multifamily housing near transit.";

const broadbandText =
  "Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled, SECTION 1. SHORT TITLE. This Act may be cited as the 'Rural Broadband Mapping Act'. SECTION 2. CHALLENGE PROCESS. The Commission shall establish a process through which an individual may challenge the accuracy of a coverage map within 90 days of its publication. SECTION 3. PUBLIC MAP. The Commission shall publish a searchable map showing the broadband service available at each address.";

const federal: Fixture[] = [
  {
    billNumber: "H.R. 1001",
    sourceWebsite: "congress.gov",
    existing: true,
    fullText: "",
    actions: [
      { date: day(45), text: "Introduced in House", type: "IntroReferral" },
      {
        date: day(44),
        text: "Referred to the Committee on Transportation and Infrastructure.",
        type: "IntroReferral",
      },
      {
        date: day(20),
        text: "Ordered to be Reported by the Yeas and Nays: 38 - 25.",
        type: "Committee",
      },
      {
        date: day(6),
        text: "Passed/agreed to in House: On passage Passed by the Yeas and Nays: 228 - 204 (Roll no. 311).",
        type: "Floor",
      },
    ],
    featured: { order: 0, rationale: "Moving to the Senate this week." },
  },
  {
    billNumber: "S. 502",
    sourceWebsite: "congress.gov",
    existing: true,
    fullText: "",
    actions: [
      { date: day(30), text: "Introduced in Senate", type: "IntroReferral" },
      {
        date: day(30),
        text: "Read twice and referred to the Committee on Commerce, Science, and Transportation.",
        type: "IntroReferral",
      },
    ],
    featured: { order: 1, rationale: "Committee hearing scheduled." },
  },
  {
    billNumber: "H.R. 2200",
    sourceWebsite: "congress.gov",
    existing: true,
    fullText: cleanWaterText,
    actions: [
      { date: day(10), text: "Introduced in House", type: "IntroReferral" },
      {
        date: day(10),
        text: "Referred to the Committee on Energy and Commerce.",
        type: "IntroReferral",
      },
    ],
    // No facts: exercises the change-map visual.
    brief: {
      version: 8,
      legalStatus: "proposed",
      verifiedQuotes: 3,
      headline: "Replacing every lead water pipe within ten years",
      summary:
        "Water utilities would have to **dig up and replace old lead pipes** that carry water into homes, and schools would test their tap water for lead.",
      hook: "If passed, local water systems would have **ten years to replace lead pipes** they control, and every public school and child care center would test its water for lead. Grants to lower water bills are allowed but **not guaranteed**: the agency may award them, not must.",
      facts: [],
      changes: [
        {
          kind: "requires",
          title: "Water systems must replace lead pipes within ten years",
          before:
            "Utilities replace lead pipes on their own schedules, and many cities have **no firm deadline** to finish.",
          after:
            "Every public water system would have to replace the lead pipes it controls **within ten years** of the law passing.",
          reader: {
            summary:
              "If your home gets water through an old lead pipe, your water utility would have to replace the part it controls within ten years.",
            question: "Who pays for the part on my property?",
            answer:
              "The bill only covers lead lines “under its control” — the utility's part. It does not say who pays for pipe on private property between the curb and the house. In many cities that segment belongs to the homeowner, so the cost question would be settled by local rules or a separate grant program, not by this text.",
            quote: {
              text: "Each public water system shall replace all lead service lines under its control",
              locator: "Sec. 3",
            },
          },
          quote: {
            text: "Each public water system shall replace all lead service lines under its control not later than 10 years after the date of enactment of this Act",
            locator: "Sec. 3",
          },
        },
        {
          kind: "creates",
          title: "Lead testing at every public school and child care center",
          before:
            "Testing school water for lead is **voluntary in most states**, so many schools have never checked.",
          after:
            "The EPA would set up a program to test drinking water for lead at **every public school and child care facility**.",
          reader: {
            summary:
              "Children's schools and day cares would have their drinking fountains and sinks checked for lead.",
            question: "What happens if a school finds lead?",
            answer:
              "This section creates the testing program only. It does not say what a school must do after a high result — such as shutting off a fountain, notifying parents, or replacing fixtures. Those steps would depend on rules the EPA writes later.",
          },
          quote: {
            text: "test drinking water for lead at every public school and child care facility",
            locator: "Sec. 4",
          },
        },
        {
          kind: "funds",
          title: "Optional grants to lower water bills for low-income homes",
          before:
            "Federal help with water bills is limited, unlike long-standing programs for **heating and electricity bills**.",
          after:
            "The EPA **could** give states money to reduce water bills for low-income households.",
          quote: {
            text: "The Administrator may award grants to States to reduce water bills for low-income households",
            locator: "Sec. 5",
          },
        },
      ],
      affected: [
        {
          group: "Households served by lead pipes",
          takeaway:
            "These households would get their utility-owned lead pipe replaced within ten years.",
          effect:
            "Lead can leach into drinking water from old pipes. Replacement would **remove that source**, at least on the utility's side of the line.",
          direction: "gains",
        },
        {
          group: "Local water utilities",
          takeaway:
            "Utilities would face a hard deadline and large construction costs.",
          effect:
            "Systems with many lead lines would need to **raise money, hire crews, and dig up streets** on a fixed schedule; the text does not include funding for that work.",
          direction: "loses",
        },
      ],
      unknowns: [
        "The text does not say **who pays for pipe on private property**.",
        "There is **no dedicated funding** for replacement in these sections, only a deadline.",
      ],
      terms: [
        {
          term: "Service line",
          plain:
            "The pipe that carries water from the main under the street into a single building.",
        },
      ],
      reading: [],
    },
  },
  {
    billNumber: "S. 789",
    sourceWebsite: "congress.gov",
    existing: true,
    fullText: aiText,
    actions: [
      { date: day(60), text: "Introduced in Senate", type: "IntroReferral" },
      {
        date: day(60),
        text: "Read twice and referred to the Committee on Commerce, Science, and Transportation.",
        type: "IntroReferral",
      },
      {
        date: day(12),
        text: "Committee on Commerce, Science, and Transportation. Reported by Senator Kim with an amendment in the nature of a substitute. Without written report.",
        type: "Committee",
      },
    ],
    // Two full calendar dates: exercises the dates visual.
    brief: {
      version: 8,
      legalStatus: "proposed",
      verifiedQuotes: 3,
      headline:
        "Companies would have to check hiring and loan software for harm",
      summary:
        "Businesses using computer programs to decide **who gets a job, apartment, or loan** would have to test those programs first and tell people when one was used.",
      hook: "If passed, companies would need to **assess automated decision software** before using it for jobs, housing, credit, schooling, or health care, starting in 2027. People would also be **told when software helped decide** something important about them. The bill does not ban any system or say what counts as a failing assessment.",
      facts: [
        {
          label: "Assessments required from",
          value: "January 1, 2027",
          quote: {
            text: "Beginning on January 1, 2027, a covered entity shall complete an impact assessment",
            locator: "Sec. 3",
          },
        },
        {
          label: "Report to Congress due",
          value: "July 1, 2028",
          quote: {
            text: "Not later than July 1, 2028, the Commission shall submit to Congress a report",
            locator: "Sec. 5",
          },
        },
      ],
      changes: [
        {
          kind: "requires",
          title: "Testing decision software before using it",
          before:
            "Companies can use software to screen job applicants or renters **without any federal review** of how it performs.",
          after:
            "From 2027, a company would have to complete an **impact assessment** before putting such software to use.",
          reader: {
            summary:
              "Before software decides whether you get an interview, a loan, or an apartment, the company would have to study how it affects people.",
            question: "What decisions does this cover?",
            answer:
              "Only “consequential” decisions in five areas: employment, housing, credit, education, and health care. Software that recommends videos or sets ad prices is outside this definition. The rule applies whether the program makes the decision itself or “substantially supports” a person who does.",
            quote: {
              text: "makes or substantially supports a decision about employment, housing, credit, education, or health care",
              locator: "Sec. 2",
            },
          },
          quote: {
            text: "a covered entity shall complete an impact assessment before deploying an automated decision system",
            locator: "Sec. 3",
          },
        },
        {
          kind: "requires",
          title: "Telling people when software made a decision about them",
          before:
            "People usually **cannot tell** whether a rejection came from a person or an automated system.",
          after:
            "Companies would have to **notify a person** when an automated system was used for an important decision about them.",
          quote: {
            text: "A covered entity shall notify an individual when an automated decision system is used to make a consequential decision about that individual",
            locator: "Sec. 4",
          },
        },
      ],
      affected: [
        {
          group: "Job and apartment applicants",
          takeaway:
            "Applicants would learn when software was part of a decision about them.",
          effect:
            "Notice gives people a reason to ask questions, though the bill **does not create a right to appeal** or see the assessment.",
          direction: "gains",
        },
        {
          group: "Employers and lenders using screening software",
          takeaway:
            "Companies would have to document how their tools affect people before using them.",
          effect:
            "This adds **paperwork and testing costs**, especially for smaller firms that buy software from outside vendors.",
          direction: "mixed",
        },
      ],
      unknowns: [
        "The text does not say **what an assessment must find** or whether a bad result blocks use.",
        "It is unclear whether **software vendors or the companies using them** count as the covered entity.",
      ],
      terms: [
        {
          term: "Impact assessment",
          plain:
            "A written review of how a system works, who it affects, and what could go wrong.",
        },
      ],
      reading: [],
    },
  },
  {
    billNumber: "H.R. 3456",
    sourceWebsite: "congress.gov",
    existing: true,
    fullText: housingText,
    actions: [
      { date: day(20), text: "Introduced in House", type: "IntroReferral" },
      {
        date: day(20),
        text: "Referred to the Committee on Ways and Means, and in addition to the Committee on Financial Services.",
        type: "IntroReferral",
      },
    ],
    // A bare percentage: exercises the percentage visual.
    brief: {
      version: 8,
      legalStatus: "proposed",
      verifiedQuotes: 3,
      headline: "More tax credits to build homes people can afford",
      summary:
        "The government would offer builders **bigger tax breaks** for apartments with lower rents, and reward cities that allow more housing.",
      hook: "If passed, each state could hand out **50% more housing tax credits** to developers, and buildings that use them would have to keep **at least one in five units** affordable. Cities that loosen zoning could win grants, though the text does not say how much.",
      facts: [
        {
          label: "Units reserved for lower-income renters",
          value: "20%",
          note: "Minimum share; households at or below 60% of area median income.",
          quote: {
            text: "reserve not less than 20 percent of units for households earning 60 percent or less of area median income",
            locator: "Sec. 3",
          },
        },
        {
          label: "Increase in each state's credits",
          value: "50% more",
          quote: {
            text: "The annual credit ceiling for each State shall be increased by 50 percent",
            locator: "Sec. 2",
          },
        },
      ],
      changes: [
        {
          kind: "expands",
          title: "Half again as many housing tax credits for every state",
          before:
            "Each state gets a **fixed yearly amount** of tax credits it can award to affordable housing developers.",
          after:
            "That yearly amount would rise **by 50 percent**, so states could support more projects.",
          reader: {
            summary:
              "Your state could help pay for more apartments with below-market rents by giving builders larger tax breaks.",
            question: "How does a tax credit build housing?",
            answer:
              "A developer that wins credits from the state sells them to investors, usually banks, for cash. That cash pays part of the construction cost, so the building needs less debt and can charge lower rents. In return, the developer must keep some units affordable for years.",
            quote: {
              text: "The annual credit ceiling for each State shall be increased by 50 percent",
              locator: "Sec. 2",
            },
          },
          quote: {
            text: "The annual credit ceiling for each State shall be increased by 50 percent",
            locator: "Sec. 2",
          },
        },
        {
          kind: "requires",
          title: "One in five units kept affordable",
          before:
            "Projects choose from **several affordability options** under current rules.",
          after:
            "Assisted projects would need to reserve **at least 20 percent** of units for lower-income households.",
          quote: {
            text: "reserve not less than 20 percent of units for households earning 60 percent or less of area median income",
            locator: "Sec. 3",
          },
        },
        {
          kind: "funds",
          title: "Grants for cities that allow more homes",
          before:
            "Federal housing money is generally **not tied to local zoning** choices.",
          after:
            "Cities that **shrink minimum lot sizes or allow apartments near transit** could receive federal grants.",
          quote: {
            text: "award grants to local governments that reduce minimum lot sizes or permit multifamily housing near transit",
            locator: "Sec. 4",
          },
        },
      ],
      affected: [
        {
          group: "Renters earning under 60% of local median income",
          takeaway:
            "More income-restricted apartments would be built for these renters.",
          effect:
            "More credits mean **more projects can be financed**, adding units with capped rents.",
          direction: "gains",
        },
        {
          group: "Cities with restrictive zoning",
          takeaway:
            "These cities would be offered money to allow more housing but would not be forced to.",
          effect:
            "The grants are an **incentive, not a mandate**; cities that keep current zoning lose nothing but the grant.",
          direction: "unclear",
        },
      ],
      unknowns: [
        "The text does not set **how much grant money** cities could receive.",
        "It does not say **how long units must stay affordable**.",
      ],
      terms: [
        {
          term: "Area median income",
          plain:
            "The middle household income in a region; half of households earn more and half earn less.",
        },
      ],
      reading: [],
    },
  },
  {
    billNumber: "H.R. 812",
    sourceWebsite: "congress.gov",
    title: "Rural Broadband Mapping Act",
    description:
      "Requires the FCC to publish an address-level broadband map and let residents challenge it.",
    sponsor: "Rep. Lena Ortiz (R-NM-2)",
    chamber: "House",
    congress: 119,
    introducedDate: daysAgo(210),
    summary:
      "Creates a public, searchable broadband map and a 90-day challenge process.",
    fullText: broadbandText,
    url: "https://www.congress.gov/bill/119th-congress/house-bill/812",
    thumbnailUrl: "https://picsum.photos/seed/broadband/800/600",
    actions: [
      { date: day(210), text: "Introduced in House", type: "IntroReferral" },
      {
        date: day(120),
        text: "On motion to suspend the rules and pass the bill Agreed to by the Yeas and Nays: 402 - 11 (Roll no. 188).",
        type: "Floor",
      },
      {
        date: day(30),
        text: "Passed Senate without amendment by Unanimous Consent.",
        type: "Floor",
      },
      { date: day(9), text: "Presented to President.", type: "President" },
      { date: day(3), text: "Signed by President.", type: "President" },
      {
        date: day(3),
        text: "Became Public Law No: 119-42.",
        type: "BecameLaw",
      },
    ],
    featured: { order: 2, rationale: "Signed into law this week." },
    brief: {
      version: 8,
      legalStatus: "enacted",
      verifiedQuotes: 2,
      headline: "You can now dispute the government's internet coverage map",
      summary:
        "The FCC must publish a map of **internet service at every address**, and residents can challenge it if it says they have service they don't.",
      hook: "This law requires the FCC to publish a **searchable map of internet service at each address** and gives people **90 days to challenge** a map they think is wrong. Those maps help decide where federal broadband money goes, so a correction can affect whether a neighborhood qualifies.",
      facts: [
        {
          label: "Window to challenge a map",
          value: "90 days",
          note: "Counted from when each map is published.",
          quote: {
            text: "challenge the accuracy of a coverage map within 90 days of its publication",
            locator: "Sec. 2",
          },
        },
      ],
      changes: [
        {
          kind: "creates",
          title: "A way for residents to challenge the coverage map",
          before:
            "Maps were built mostly from **providers' own claims**, and residents had few ways to correct them.",
          after:
            "Anyone can **challenge the map within 90 days** of its publication.",
          reader: {
            summary:
              "If the map says fast internet is available at your home but it isn't, you now have a formal way to say so.",
            question: "Why does a map error matter?",
            answer:
              "Federal broadband grants usually go to places the map shows as unserved. If your address is wrongly marked as covered, your area may be skipped. A successful challenge can change that classification and make the area eligible.",
          },
          quote: {
            text: "an individual may challenge the accuracy of a coverage map within 90 days of its publication",
            locator: "Sec. 2",
          },
        },
        {
          kind: "requires",
          title: "A public map of service at every address",
          before:
            "Coverage was often reported by **census block**, so one connected home could mark a whole area as served.",
          after:
            "The FCC must publish a **searchable map showing service at each address**.",
          quote: {
            text: "publish a searchable map showing the broadband service available at each address",
            locator: "Sec. 3",
          },
        },
      ],
      affected: [
        {
          group: "Rural households without reliable internet",
          takeaway:
            "These households can now correct maps that wrongly show them as served.",
          effect:
            "Accurate maps make it **more likely their area qualifies** for build-out funding.",
          direction: "gains",
        },
      ],
      unknowns: [
        "The law does not say **how quickly the FCC must resolve** a challenge.",
      ],
      terms: [],
      reading: [],
    },
  },
];

// ── California: the local rail ──────────────────────────────────────────────

const heatText =
  "The people of the State of California do enact as follows: SECTION 1. Section 6720 is added to the Labor Code, to read: (a) An employer shall provide cool-down rest periods in a cooled area to an indoor employee when the heat index in the work area reaches 82 degrees Fahrenheit. (b) An employer shall implement active cooling measures, including air conditioning or evaporative coolers, when the heat index reaches 87 degrees Fahrenheit. (c) This section does not apply to an employee who works fewer than 15 minutes in any 60-minute period in the work area.";

const fareText =
  "The people of the State of California do enact as follows: SECTION 1. Section 99318 is added to the Public Utilities Code, to read: (a) A transit operator that receives state transit assistance shall provide free fares to any rider 18 years of age or younger. (b) The state shall reimburse a transit operator for lost fare revenue from the Youth Transit Pass Fund, subject to appropriation by the Legislature.";

const wildfireText =
  "The people of the State of California do enact as follows: SECTION 1. Section 4290.6 is added to the Public Resources Code, to read: (a) The State Fire Marshal shall award grants of up to $25,000 per residence to retrofit homes in very high fire hazard severity zones with ember-resistant vents and noncombustible roofing. (b) A household earning 80 percent or less of the area median income may receive a grant covering the full cost of the retrofit.";

const parkingText =
  "The people of the State of California do enact as follows: SECTION 1. Section 65863.3 is added to the Government Code, to read: A city or county shall not impose a minimum automobile parking requirement on a residential development project located within one-half mile of a major transit stop.";

const california: Fixture[] = [
  {
    billNumber: "CA SB 1207",
    sourceWebsite: "openstates.org",
    title: "Indoor workplace heat protection",
    description:
      "Requires cool-down breaks and active cooling for indoor workers when heat reaches set thresholds.",
    sponsor: "Sen. Rosa Delgado",
    chamber: "Senate",
    introducedDate: daysAgo(70),
    summary:
      "Sets heat-index thresholds for cool-down breaks and active cooling in indoor workplaces.",
    fullText: heatText,
    url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=20252026SB1207",
    thumbnailUrl: "https://picsum.photos/seed/heat/800/600",
    actions: [
      {
        date: day(70),
        text: "Introduced. Read first time.",
        type: "introduction",
      },
      {
        date: day(55),
        text: "Referred to Com. on L., P.E. & R.",
        type: "referral-committee",
      },
      {
        date: day(30),
        text: "Do pass and re-refer to Com. on APPR. (Ayes 4. Noes 1.)",
        type: "committee-passage",
      },
      {
        date: day(5),
        text: "Read third time. Passed. (Ayes 28. Noes 10.) Ordered to the Assembly.",
        type: "passage",
      },
    ],
    featured: { order: 0, rationale: "Passed the Senate on Monday." },
    // Two proposed heat-index thresholds: exercises the temperature visual.
    brief: {
      version: 8,
      legalStatus: "proposed",
      verifiedQuotes: 3,
      headline:
        "Cool-down breaks for warehouse and kitchen workers in extreme heat",
      summary:
        "Employers would have to give indoor workers **cooled rest breaks** once it gets hot, and turn on air conditioning or coolers when it gets hotter.",
      hook: "If this becomes law, indoor workers such as warehouse and restaurant staff would get **cool-down breaks once the heat index hits 82°F**, and employers would have to **run cooling at 87°F**. People who spend only a few minutes an hour in the hot area are not covered.",
      facts: [
        {
          label: "Cool-down breaks start",
          value: "82°F heat index",
          note: "Proposed threshold for rest periods in a cooled area.",
          quote: {
            text: "when the heat index in the work area reaches 82 degrees Fahrenheit",
            locator: "Sec. 1(a)",
          },
        },
        {
          label: "Active cooling required",
          value: "87°F heat index",
          note: "Proposed threshold for air conditioning or evaporative coolers.",
          quote: {
            text: "when the heat index reaches 87 degrees Fahrenheit",
            locator: "Sec. 1(b)",
          },
        },
        {
          label: "Exempt if in the area less than",
          value: "15 minutes per hour",
        },
      ],
      changes: [
        {
          kind: "requires",
          title: "Cooled rest breaks once heat index hits 82°F",
          before:
            "California's detailed heat rules mostly protect **outdoor** workers; indoor heat rules are far less specific.",
          after:
            "Employers would have to give indoor workers **cool-down rest periods in a cooled area** at an 82°F heat index.",
          reader: {
            summary:
              "If you work in a hot warehouse, kitchen, or factory, you could take breaks somewhere cool once the air feels like 82°F.",
            question: "What is the heat index?",
            answer:
              "The heat index combines temperature and humidity into one number for how hot the air feels to the body. Humid air makes sweat evaporate more slowly, so 80°F with high humidity can feel like 85°F or more. The bill uses that felt temperature, not the thermostat reading, as its trigger.",
          },
          quote: {
            text: "An employer shall provide cool-down rest periods in a cooled area to an indoor employee when the heat index in the work area reaches 82 degrees Fahrenheit",
            locator: "Sec. 1(a)",
          },
        },
        {
          kind: "requires",
          title: "Air conditioning or coolers at 87°F",
          before:
            "Employers decide for themselves whether and when to **cool an indoor work area**.",
          after:
            "At an 87°F heat index, employers would have to use **active cooling such as air conditioning or evaporative coolers**.",
          quote: {
            text: "An employer shall implement active cooling measures, including air conditioning or evaporative coolers, when the heat index reaches 87 degrees Fahrenheit",
            locator: "Sec. 1(b)",
          },
        },
      ],
      affected: [
        {
          group: "Warehouse, kitchen, and factory workers",
          takeaway:
            "Indoor workers in hot spaces would get cooled breaks and cooling equipment at set temperatures.",
          effect:
            "Clear triggers replace case-by-case judgment, which may **reduce heat illness** on the hottest days.",
          direction: "gains",
        },
        {
          group: "Employers with large unconditioned buildings",
          takeaway:
            "These employers would need to buy and run cooling equipment.",
          effect:
            "Cooling a large warehouse can be **expensive to install and operate**, especially in inland regions.",
          direction: "loses",
        },
      ],
      unknowns: [
        "The text does not say **how the heat index must be measured** or by whom.",
        "It does not set **how long or how frequent** cool-down breaks must be.",
      ],
      terms: [
        {
          term: "Heat index",
          plain:
            "A number combining temperature and humidity to describe how hot it feels to the human body.",
        },
      ],
      reading: [],
    },
    lens: {
      framing: "proponent_opponent",
      left: {
        stance: "Set clear heat limits",
        points: [
          {
            text: "Fixed thresholds tell every employer exactly when to act, instead of leaving it to judgment on the hottest days.",
            example: {
              fact: "California already uses an 80°F trigger for shade access in its outdoor heat rule.",
              relevance:
                "A number-based trigger has worked outdoors; this bill extends the same approach indoors.",
            },
            sourceIds: [1],
          },
        ],
      },
      right: {
        stance: "Account for cooling costs",
        points: [
          {
            text: "Air-conditioning a large warehouse costs far more than providing shade outdoors.",
            example: {
              fact: "The bill requires active cooling at 87°F regardless of building size.",
              relevance:
                "Without size-based exceptions, small employers with large buildings face the same mandate as large ones.",
            },
            sourceIds: [1],
          },
        ],
      },
      sources: [
        {
          id: 1,
          title: "SB 1207 — bill text",
          url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=20252026SB1207",
        },
      ],
    },
  },
  {
    billNumber: "CA AB 1450",
    sourceWebsite: "openstates.org",
    title: "Wildfire home hardening grants",
    description:
      "Creates grants to fireproof homes in the highest-risk wildfire zones.",
    sponsor: "Asm. Daniel Huang",
    chamber: "Assembly",
    introducedDate: daysAgo(90),
    summary:
      "Grants up to $25,000 per home for ember-resistant vents and noncombustible roofs.",
    fullText: wildfireText,
    url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=20252026AB1450",
    thumbnailUrl: "https://picsum.photos/seed/wildfire/800/600",
    actions: [
      {
        date: day(90),
        text: "Introduced. Read first time.",
        type: "introduction",
      },
      {
        date: day(80),
        text: "Referred to Com. on NAT. RES.",
        type: "referral-committee",
      },
      {
        date: day(40),
        text: "Read third time. Passed. Ordered to the Senate. (Ayes 70. Noes 4.)",
        type: "passage",
      },
      {
        date: day(8),
        text: "Referred to Com. on N.R. & W.",
        type: "referral-committee",
      },
    ],
    featured: { order: 1, rationale: "Senate committee hearing next week." },
    brief: {
      version: 8,
      legalStatus: "proposed",
      verifiedQuotes: 2,
      headline:
        "Up to $25,000 to fireproof homes in the riskiest wildfire areas",
      summary:
        "The state would pay homeowners in the most fire-prone areas to install **vents and roofs that resist flying embers**, a leading cause of homes burning.",
      hook: "If passed, homeowners in **very high fire hazard zones** could get up to **$25,000** to retrofit vents and roofs, and lower-income households could have the full cost covered. The text does not say how much total money the program would have.",
      facts: [
        {
          label: "Maximum grant per home",
          value: "$25,000",
          quote: {
            text: "grants of up to $25,000 per residence",
            locator: "Sec. 1(a)",
          },
        },
        {
          label: "Full cost covered at or below",
          value: "80% of area median income",
        },
      ],
      changes: [
        {
          kind: "funds",
          title: "Grants to fireproof vents and roofs",
          before:
            "Retrofits are mostly **paid out of pocket**, with a few small local programs.",
          after:
            "The State Fire Marshal would award up to **$25,000 per home** for ember-resistant vents and noncombustible roofing.",
          reader: {
            summary:
              "If you live in one of California's highest-risk fire areas, the state could help pay to make your home harder to ignite.",
            question: "Why vents and roofs specifically?",
            answer:
              "Most homes lost in wildfires are ignited by embers blown ahead of the flames, not by the fire front itself. Embers get into attics through vents or land on flammable roofs. Ember-resistant vents and noncombustible roofs close the two most common entry points.",
          },
          quote: {
            text: "retrofit homes in very high fire hazard severity zones with ember-resistant vents and noncombustible roofing",
            locator: "Sec. 1(a)",
          },
        },
      ],
      affected: [
        {
          group: "Homeowners in very high fire hazard zones",
          takeaway:
            "These homeowners could get help paying for retrofits that lower their home's fire risk.",
          effect:
            "Retrofits may also **help with insurance**, though the bill does not require insurers to recognize them.",
          direction: "gains",
        },
      ],
      unknowns: [
        "The text does not say **how much total funding** the program gets each year.",
      ],
      terms: [],
      reading: [],
    },
  },
  {
    billNumber: "CA AB 2011",
    sourceWebsite: "openstates.org",
    title: "Free transit for riders 18 and under",
    description:
      "Requires state-funded transit agencies to offer free fares to youth riders.",
    sponsor: "Asm. Priya Natarajan",
    chamber: "Assembly",
    introducedDate: daysAgo(240),
    summary:
      "Free fares for riders 18 and under, reimbursed from a state fund.",
    fullText: fareText,
    url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=20252026AB2011",
    thumbnailUrl: "https://picsum.photos/seed/transit/800/600",
    actions: [
      {
        date: day(240),
        text: "Introduced. Read first time.",
        type: "introduction",
      },
      {
        date: day(150),
        text: "Read third time. Passed. Ordered to the Senate. (Ayes 54. Noes 20.)",
        type: "passage",
      },
      {
        date: day(40),
        text: "Read third time. Passed. Ordered to the Assembly. (Ayes 29. Noes 9.)",
        type: "passage",
      },
      {
        date: day(25),
        text: "Enrolled and presented to the Governor.",
        type: "executive-receipt",
      },
      { date: day(4), text: "Vetoed by Governor.", type: "executive-veto" },
    ],
    brief: {
      version: 8,
      legalStatus: "proposed",
      verifiedQuotes: 2,
      headline: "Free bus and train rides for kids and teens",
      summary:
        "Transit agencies that get state money would have had to let **riders 18 and under ride free**, with the state covering lost fares.",
      hook: "This bill would have required transit agencies receiving state aid to give **free fares to riders 18 and younger**. The state would have reimbursed agencies, but **only if lawmakers set aside the money** each year.",
      facts: [{ label: "Free fares for ages", value: "18 and under" }],
      changes: [
        {
          kind: "requires",
          title: "Free fares for riders 18 and under",
          before:
            "Each transit agency sets its own youth fares; **some are free, many are discounted**.",
          after:
            "Every agency receiving state transit aid would offer **free rides to anyone 18 or younger**.",
          reader: {
            summary:
              "Kids and teens would have ridden buses and trains free on any transit system that receives state funding.",
            question: "Who would have paid for it?",
            answer:
              "The state would reimburse agencies for lost fares from a Youth Transit Pass Fund — but only “subject to appropriation,” meaning lawmakers would need to approve the money in each year's budget. If they didn't, agencies would still owe free rides without the reimbursement.",
            quote: {
              text: "subject to appropriation by the Legislature",
              locator: "Sec. 1(b)",
            },
          },
          quote: {
            text: "shall provide free fares to any rider 18 years of age or younger",
            locator: "Sec. 1(a)",
          },
        },
      ],
      affected: [
        {
          group: "Students who ride transit to school",
          takeaway: "Students would have stopped paying fares.",
          effect:
            "Families would **save on daily commuting costs**, especially in areas without school buses.",
          direction: "gains",
        },
        {
          group: "Transit agencies",
          takeaway:
            "Agencies would have lost fare revenue with uncertain repayment.",
          effect:
            "Reimbursement **depended on yearly budget decisions**, leaving agencies exposed if funding fell short.",
          direction: "mixed",
        },
      ],
      unknowns: [
        "The text did not say **how much the state would set aside** for reimbursement.",
      ],
      terms: [
        {
          term: "Subject to appropriation",
          plain:
            "The money is promised in principle, but lawmakers must still approve it in a budget before it can be spent.",
        },
      ],
      reading: [],
    },
  },
  {
    billNumber: "CA SB 330",
    sourceWebsite: "openstates.org",
    title: "No parking minimums near transit",
    description:
      "Bars cities from requiring parking spaces for homes built near major transit stops.",
    sponsor: "Sen. Marcus Bell",
    chamber: "Senate",
    introducedDate: daysAgo(120),
    summary:
      "Bans minimum parking requirements for housing within a half mile of major transit.",
    fullText: parkingText,
    url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=20252026SB330",
    thumbnailUrl: "https://picsum.photos/seed/parking/800/600",
    actions: [
      {
        date: day(120),
        text: "Introduced. Read first time.",
        type: "introduction",
      },
      {
        date: day(100),
        text: "Referred to Com. on HOUSING.",
        type: "referral-committee",
      },
      {
        date: day(11),
        text: "Failed passage in committee. (Ayes 3. Noes 5.)",
        type: "failure",
      },
    ],
    brief: {
      version: 8,
      legalStatus: "proposed",
      verifiedQuotes: 1,
      headline: "Letting builders skip required parking near transit",
      summary:
        "Cities could no longer force new housing near train and major bus stops to include **a set number of parking spaces**.",
      hook: "This bill would have stopped cities from requiring parking for new homes **within half a mile of a major transit stop**. Builders could still add parking; they just would not be forced to.",
      facts: [{ label: "Distance from transit", value: "Half a mile" }],
      changes: [
        {
          kind: "restricts",
          title: "Cities can't require parking near transit",
          before:
            "Many cities require **one or two parking spaces per unit**, even next to a train station.",
          after:
            "Cities could **not require any minimum parking** for homes within half a mile of a major transit stop.",
          reader: {
            summary:
              "New apartments near train stations could be built with fewer parking spaces, or none, if the builder chose.",
            question: "Why does parking affect housing?",
            answer:
              "Parking garages are expensive: a single underground space can cost tens of thousands of dollars to build. Required spaces raise construction costs and take room that could hold more homes. Removing the requirement lets builders decide how much parking residents near transit actually need.",
          },
          quote: {
            text: "shall not impose a minimum automobile parking requirement on a residential development project located within one-half mile of a major transit stop",
            locator: "Sec. 1",
          },
        },
      ],
      affected: [
        {
          group: "Residents near transit stops",
          takeaway: "Neighbors could see more competition for street parking.",
          effect:
            "Fewer off-street spaces in new buildings may **push some cars onto nearby streets**.",
          direction: "unclear",
        },
      ],
      unknowns: [
        "The text did not define **what counts as a major transit stop**.",
      ],
      terms: [],
      reading: [],
    },
  },
];

// ── Headline + reader follow-ups for the base seed's two v8 briefs ──────────

const basePatches: Record<
  string,
  {
    headline: string;
    readers: (NonNullable<Brief["changes"][number]["reader"]> | undefined)[];
  }
> = {
  "H.R. 1001": {
    headline: "Ten years of road and bridge money for states",
    readers: [
      {
        summary:
          "Your state could plan road and bridge repairs years ahead, because federal money would be promised for a decade instead of a few years.",
        question: "Is the $200 billion guaranteed?",
        answer:
          "No. The bill sets a ten-year maximum. Congress would still decide each year how much of it agencies can actually spend, and could approve less than the full amount. States get a longer planning horizon, not a deposit.",
      },
      {
        summary:
          "Cities could apply to a dedicated pot of money for light rail and faster bus lines instead of competing with highway projects.",
        question: "Which cities would get the money?",
        answer:
          "The bill creates the grant pool but leaves the selection rules to later federal guidance. Until those rules exist, it is not possible to say which cities qualify or how much any one city would receive.",
      },
    ],
  },
  "S. 502": {
    headline: "Companies would need permission to collect your data",
    readers: [
      {
        summary:
          "Apps and websites would have to ask before collecting or selling most of your personal information.",
        question: "Does this replace my state's privacy law?",
        answer:
          "The bill text shown does not say. If federal rules replace state laws, people in states with stronger protections, like California, could lose some rights. If they add to state laws, everyone gets at least the federal floor.",
      },
      {
        summary:
          "You could ask a company to show you what it knows about you and delete it.",
        question: "What can I ask a company to do?",
        answer:
          "Two things: show you the personal data it has collected about you, and delete it. The section does not mention correcting data or moving it to another service.",
        quote: {
          text: "A covered entity shall provide an individual with the right to access and delete personal data collected about the individual",
          locator: "Sec. 3",
        },
      },
    ],
  },
};

// ── Write ───────────────────────────────────────────────────────────────────

function verifyQuotes(fx: Fixture, fullText: string) {
  const quotes = [
    ...(fx.brief?.facts ?? []).map((f) => f.quote),
    ...(fx.brief?.changes ?? []).flatMap((c) => [c.quote, c.reader?.quote]),
  ].filter((q): q is { text: string } => !!q);
  for (const q of quotes) {
    if (!fullText.includes(q.text)) {
      throw new Error(`${fx.billNumber}: quote not in fullText: "${q.text}"`);
    }
  }
}

const fixtures = [...federal, ...california];

for (const fx of fixtures) {
  if (fx.existing) {
    const [row] = await db
      .select({ fullText: Bill.fullText, title: Bill.title })
      .from(Bill)
      .where(eq(Bill.billNumber, fx.billNumber));
    if (!row)
      throw new Error(`${fx.billNumber} missing; run the base seed first.`);
    const fullText = fx.fullText || row.fullText || "";
    verifyQuotes(fx, fullText);
    const last = fx.actions.at(-1);
    await db
      .update(Bill)
      .set({
        fullText,
        contentHash: hash(row.title + fullText),
        actions: fx.actions,
        status: last?.text,
        lastActionAt: last ? new Date(last.date) : null,
      })
      .where(eq(Bill.billNumber, fx.billNumber));
  } else {
    verifyQuotes(fx, fx.fullText);
    const last = fx.actions.at(-1);
    const values = {
      billNumber: fx.billNumber,
      sourceWebsite: fx.sourceWebsite,
      title: fx.title!,
      description: clampBillDescription(fx.description ?? null),
      sponsor: fx.sponsor,
      chamber: fx.chamber,
      congress: fx.congress,
      introducedDate: fx.introducedDate,
      summary: fx.summary,
      fullText: fx.fullText,
      url: fx.url!,
      thumbnailUrl: fx.thumbnailUrl,
      actions: fx.actions,
      status: last?.text,
      lastActionAt: last ? new Date(last.date) : null,
      contentHash: hash(fx.title! + fx.fullText),
      versions: [],
    };
    await db
      .insert(Bill)
      .values(values)
      .onConflictDoUpdate({
        target: [Bill.billNumber, Bill.sourceWebsite],
        set: values,
      });
  }
}

const rows = await db
  .select({
    id: Bill.id,
    billNumber: Bill.billNumber,
    contentHash: Bill.contentHash,
  })
  .from(Bill)
  .where(
    inArray(
      Bill.billNumber,
      fixtures.map((f) => f.billNumber),
    ),
  );
const byNumber = new Map(rows.map((r) => [r.billNumber, r]));

let briefs = 0;
for (const fx of fixtures) {
  const bill = byNumber.get(fx.billNumber)!;
  let brief: unknown;
  if (fx.brief) {
    brief = {
      ...fx.brief,
      generatedAt: now.toISOString(),
      modelVersion: "seed-review",
    };
  } else if (basePatches[fx.billNumber]) {
    const [existing] = await db
      .select({ brief: ContentBrief.brief })
      .from(ContentBrief)
      .where(eq(ContentBrief.contentId, bill.id));
    if (!existing) continue;
    const patch = basePatches[fx.billNumber]!;
    const base = existing.brief as BillBriefRecord;
    brief = {
      ...base,
      headline: patch.headline,
      changes: base.changes.map((change, i) => ({
        ...change,
        ...(patch.readers[i] ? { reader: patch.readers[i] } : {}),
      })),
    };
  } else continue;

  const parsed = BillBriefRecordSchema.safeParse(brief);
  if (!parsed.success) {
    throw new Error(`${fx.billNumber}: invalid brief\n${parsed.error.message}`);
  }
  await db
    .insert(ContentBrief)
    .values({
      contentType: "bill",
      contentId: bill.id,
      contentHash: bill.contentHash,
      brief: parsed.data,
      modelVersion: parsed.data.modelVersion,
    })
    .onConflictDoUpdate({
      target: [ContentBrief.contentType, ContentBrief.contentId],
      set: {
        contentHash: sql`excluded.content_hash`,
        brief: sql`excluded.brief`,
        modelVersion: sql`excluded.model_version`,
        updatedAt: now,
      },
    });
  briefs++;
}

// The base seed's lenses were keyed to the old hashes; keep them attached.
for (const bill of rows) {
  await db
    .update(ContentLens)
    .set({ contentHash: bill.contentHash })
    .where(eq(ContentLens.contentId, bill.id));
}
let lenses = 0;
for (const fx of fixtures.filter((f) => f.lens)) {
  const bill = byNumber.get(fx.billNumber)!;
  const lensData = {
    ...fx.lens,
    generatedAt: now.toISOString(),
    modelVersion: "seed-review",
  } as typeof ContentLens.$inferInsert.lensData;
  await db
    .insert(ContentLens)
    .values({
      contentType: "bill",
      contentId: bill.id,
      contentHash: bill.contentHash,
      lensData,
      modelVersion: "seed-review",
    })
    .onConflictDoUpdate({
      target: [ContentLens.contentType, ContentLens.contentId],
      set: { contentHash: bill.contentHash, lensData, updatedAt: now },
    });
  lenses++;
}

let featured = 0;
for (const fx of fixtures.filter((f) => f.featured)) {
  const bill = byNumber.get(fx.billNumber)!;
  const values = {
    billId: bill.id,
    displayOrder: fx.featured!.order,
    rationale: fx.featured!.rationale,
    curatedBy: "seed-review",
    active: true,
  };
  await db
    .insert(FeaturedBill)
    .values(values)
    .onConflictDoUpdate({ target: FeaturedBill.billId, set: values });
  featured++;
}

console.log(
  `Review fixtures: ${fixtures.length} bills, ${briefs} briefs, ${lenses} lenses, ${featured} featured.`,
);
process.exit(0);
