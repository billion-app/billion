import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";

import type { BillBriefRecord } from "@acme/validators";

import { clampBillDescription } from "./src/bill-description";
import { db } from "./src/client";
import {
  Bill,
  ContentBrief,
  ContentLens,
  CourtCase,
  GovernmentContent,
  Video,
} from "./src/schema";

function hash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function assertSeedTargetIsLocal() {
  const rawUrl = process.env.POSTGRES_URL;
  if (!rawUrl) {
    throw new Error("Missing POSTGRES_URL");
  }

  let host: string;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    throw new Error("POSTGRES_URL is not a valid connection string.");
  }

  if (LOCAL_HOSTS.has(host)) return;
  if (process.env.SEED_CONFIRM_REMOTE_HOST === host) return;

  throw new Error(
    `Refusing to seed fake/placeholder content into "${host}" — POSTGRES_URL ` +
      `does not point at a local database.\n` +
      `This script inserts mock bills, court cases, and executive orders ` +
      `(e.g. fabricated URLs like ".../opinion/mock-gonzalez") that must never ` +
      `land in a real database.\n` +
      `If you are certain "${host}" is the intended target, re-run with ` +
      `SEED_CONFIRM_REMOTE_HOST=${host} set explicitly.`,
  );
}

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

const bills = [
  {
    billNumber: "H.R. 1001",
    title: "Infrastructure Modernization Act of 2025",
    description:
      "A bill to authorize funding for the repair and modernization of roads, bridges, and public transit systems across the United States.",
    sponsor: "Rep. Maria Torres (D-CA-12)",
    status: "Passed House",
    introducedDate: daysAgo(45),
    congress: 119,
    chamber: "House",
    summary:
      "Authorizes $200 billion over 10 years for infrastructure modernization including roads, bridges, and transit.",
    fullText:
      "Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled, SECTION 1. SHORT TITLE. This Act may be cited as the 'Infrastructure Modernization Act of 2025'. SECTION 2. FINDINGS. Congress finds that the nation's infrastructure is in critical need of repair and modernization...",
    aiGeneratedArticle: `# What This Means For You
Your daily commute could get a lot better. This bill allocates $200 billion to fix crumbling roads and bridges and expand public transit options.

# Overview
The Infrastructure Modernization Act of 2025 is a sweeping proposal to address decades of deferred maintenance on America's roads, bridges, and public transit systems. The bill authorizes $200 billion in federal spending over the next decade, with funds distributed to states based on a formula that considers population, road conditions, and transit ridership.

Key provisions include dedicated funding for bridge repair, expansion of rural broadband infrastructure, and grants for cities looking to build or expand light rail and bus rapid transit systems. The bill also includes provisions for workforce development, aiming to create an estimated 500,000 construction and engineering jobs.

# Impact & Implications
If enacted, this bill would represent one of the largest infrastructure investments in a generation. Commuters in urban areas could see reduced congestion and improved transit options, while rural communities would benefit from better road conditions and expanded broadband access. Construction workers and engineers would see increased job opportunities, and supply chains could become more efficient with improved transportation networks.

# The Debate
Supporters argue the bill is long overdue, pointing to the American Society of Civil Engineers' consistent D+ rating for U.S. infrastructure. They emphasize the economic multiplier effect of infrastructure spending and the safety benefits of repairing structurally deficient bridges. Critics raise concerns about the bill's price tag and question whether the federal government should take the lead on what they see as primarily state and local responsibilities. Some fiscal hawks have proposed alternative funding mechanisms, including public-private partnerships and toll-based financing.`,
    thumbnailUrl: "https://picsum.photos/seed/infra/800/600",
    images: [],
    url: "https://www.congress.gov/bill/119th-congress/house-bill/1001",
    sourceWebsite: "congress.gov",
  },
  {
    billNumber: "S. 502",
    title: "Digital Privacy Protection Act",
    description:
      "A bill to establish comprehensive federal data privacy protections for consumers and regulate the collection and sale of personal data.",
    sponsor: "Sen. James Chen (R-TX)",
    status: "In Committee",
    introducedDate: daysAgo(30),
    congress: 119,
    chamber: "Senate",
    summary:
      "Establishes federal data privacy standards requiring companies to obtain consent before collecting personal data.",
    fullText:
      "Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled, SECTION 1. SHORT TITLE. This Act may be cited as the 'Digital Privacy Protection Act'. SECTION 2. PURPOSE. The purpose of this Act is to establish comprehensive federal data privacy protections. SECTION 3. INDIVIDUAL DATA RIGHTS. A covered entity shall provide an individual with the right to access and delete personal data collected about the individual.",
    aiGeneratedArticle: `# What This Means For You
Companies would need your permission before collecting or selling your personal data, and you'd have the right to see and delete what they've gathered.

# Overview
The Digital Privacy Protection Act aims to create the first comprehensive federal data privacy law in the United States. Currently, data privacy is regulated through a patchwork of state laws, with California's CCPA being the most prominent. This bill would establish a uniform national standard.

The legislation requires companies to obtain explicit consent before collecting personal data, give consumers the right to access and delete their data, and prohibit the sale of data belonging to minors under 16. It also creates a new division within the FTC dedicated to data privacy enforcement.

# Impact & Implications
For everyday Americans, this bill would mean more control over personal information. Tech companies, advertisers, and data brokers would face significant new compliance requirements. Small businesses worry about the cost of compliance, while privacy advocates say the bill doesn't go far enough compared to Europe's GDPR.

# The Debate
Privacy advocates praise the bill as a necessary step but criticize exceptions that allow data collection for "legitimate business purposes," a term they say is too broadly defined. The tech industry has offered cautious support for a federal standard that would preempt the current patchwork of state laws, though they oppose provisions allowing private lawsuits. Consumer groups want stronger enforcement mechanisms and fewer corporate carve-outs.`,
    thumbnailUrl: "https://picsum.photos/seed/privacy/800/600",
    images: [],
    url: "https://www.congress.gov/bill/119th-congress/senate-bill/502",
    sourceWebsite: "congress.gov",
  },
  {
    billNumber: "H.R. 2200",
    title: "Clean Water Access Act",
    description:
      "A bill to ensure access to clean drinking water in underserved communities and update aging water treatment facilities.",
    sponsor: "Rep. Aisha Johnson (D-MI-13)",
    status: "Introduced",
    introducedDate: daysAgo(10),
    congress: 119,
    chamber: "House",
    summary:
      "Provides $50 billion for water infrastructure upgrades and lead pipe replacement in communities with contaminated water systems.",
    fullText:
      "Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled, SECTION 1. SHORT TITLE. This Act may be cited as the 'Clean Water Access Act'. SECTION 2. FINDINGS. Congress finds that millions of Americans lack access to clean, safe drinking water...",
    aiGeneratedArticle: `# What This Means For You
If you live in a community with aging water infrastructure, this bill could fund the replacement of lead pipes and upgrade your local water treatment facility.

# Overview
The Clean Water Access Act addresses the ongoing crisis of contaminated drinking water in communities across the United States. Inspired by the water crises in Flint, Michigan, and Jackson, Mississippi, the bill provides $50 billion in federal funding to replace lead service lines, upgrade water treatment plants, and expand water quality monitoring.

The bill prioritizes funding for environmental justice communities that have been disproportionately affected by water contamination. It also establishes a federal water quality dashboard that would make testing results publicly accessible in real time.

# Impact & Implications
An estimated 10 million American households still receive water through lead service lines. This bill would accelerate their replacement, potentially preventing thousands of cases of lead poisoning in children. Water utilities would receive federal support for upgrades they've deferred for decades due to funding constraints.

# The Debate
Supporters point to the moral imperative of clean water access, citing ongoing health emergencies in several U.S. cities. Critics question the federal government's role, arguing that water infrastructure has traditionally been a local responsibility. Some propose a loan-based model rather than direct grants, while environmental groups push for stricter contamination standards alongside the funding.`,
    thumbnailUrl: "https://picsum.photos/seed/water/800/600",
    images: [],
    url: "https://www.congress.gov/bill/119th-congress/house-bill/2200",
    sourceWebsite: "congress.gov",
  },
  {
    billNumber: "S. 789",
    title: "AI Accountability and Transparency Act",
    description:
      "A bill to require disclosure and impact assessments for artificial intelligence systems used in high-stakes decision-making.",
    sponsor: "Sen. Rachel Kim (D-WA)",
    status: "Passed Committee",
    introducedDate: daysAgo(60),
    congress: 119,
    chamber: "Senate",
    summary:
      "Requires AI impact assessments and public disclosure for automated decision-making in hiring, lending, and criminal justice.",
    fullText:
      "Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled, SECTION 1. SHORT TITLE. This Act may be cited as the 'AI Accountability and Transparency Act'. SECTION 2. DEFINITIONS. In this Act: (1) AUTOMATED DECISION SYSTEM...",
    aiGeneratedArticle: `# What This Means For You
If AI was used to deny you a loan, reject your job application, or influence a court decision about you, this bill would give you the right to know — and to challenge it.

# Overview
The AI Accountability and Transparency Act would be the first major federal regulation of artificial intelligence in high-stakes decision-making. The bill targets AI systems used in hiring, lending, housing, healthcare, and criminal justice, requiring organizations to conduct bias audits, disclose when AI is being used, and provide explanations for AI-driven decisions.

Companies deploying AI in these domains would need to register their systems with the FTC and submit annual impact assessments. The bill also creates an AI Civil Rights Office to investigate complaints of algorithmic discrimination.

# Impact & Implications
Workers, borrowers, and defendants would gain new transparency rights when AI influences decisions about their lives. Tech companies and their enterprise customers would need to invest in explainability and audit infrastructure. The compliance costs could slow AI adoption in regulated industries, but proponents argue this is a feature, not a bug.

# The Debate
Tech companies warn that overly prescriptive regulation could stifle innovation and push AI development overseas. Civil rights organizations counter that unregulated AI is already causing harm, pointing to documented cases of biased hiring algorithms and discriminatory lending models. Some legislators prefer a sector-specific approach over the bill's broad framework, while others argue it doesn't go far enough in restricting certain uses of AI entirely.`,
    thumbnailUrl: "https://picsum.photos/seed/ai-law/800/600",
    images: [],
    url: "https://www.congress.gov/bill/119th-congress/senate-bill/789",
    sourceWebsite: "congress.gov",
  },
  {
    billNumber: "H.R. 3456",
    title: "Affordable Housing Expansion Act",
    description:
      "A bill to increase the supply of affordable housing through tax incentives, zoning reform support, and direct federal investment.",
    sponsor: "Rep. David Park (D-NY-14)",
    status: "In Committee",
    introducedDate: daysAgo(20),
    congress: 119,
    chamber: "House",
    summary:
      "Expands Low-Income Housing Tax Credit, provides grants for zoning reform, and invests $30 billion in public housing rehabilitation.",
    fullText:
      "Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled, SECTION 1. SHORT TITLE. This Act may be cited as the 'Affordable Housing Expansion Act'...",
    aiGeneratedArticle: `# What This Means For You
If you're struggling with rising rents, this bill aims to increase the supply of affordable housing in your area through a combination of tax incentives and direct investment.

# Overview
The Affordable Housing Expansion Act tackles the nation's housing crisis through a three-pronged approach: expanding the Low-Income Housing Tax Credit (LIHTC) by 50%, offering competitive grants to cities and states that reform exclusionary zoning laws, and investing $30 billion in rehabilitating the nation's aging public housing stock.

The bill also includes provisions for tenant protections, including a national standard for just-cause eviction and limits on security deposits. A new Office of Housing Innovation would fund pilot programs for alternative housing models like community land trusts and cooperative housing.

# Impact & Implications
The bill could add an estimated 2 million affordable housing units over the next decade. Renters in high-cost areas would benefit from increased supply and tenant protections. Developers would gain expanded tax incentives, while cities that loosen restrictive zoning could unlock federal grants.

# The Debate
Housing advocates strongly support the bill but want even more aggressive zoning reform provisions. Real estate interests support the LIHTC expansion but oppose the tenant protection provisions. Some conservatives argue that housing is a local issue and that federal intervention in zoning is governmental overreach. Progressive critics say the bill relies too heavily on private-sector tax incentives rather than direct public housing construction.`,
    thumbnailUrl: "https://picsum.photos/seed/housing/800/600",
    images: [],
    url: "https://www.congress.gov/bill/119th-congress/house-bill/3456",
    sourceWebsite: "congress.gov",
  },
].map((b) => ({
  ...b,
  // `bill.description` is capped at 100 characters by a check constraint, and
  // every fixture above was written longer, so the very first insert aborted
  // the whole seed. Clamp with the same helper the scraper and API use rather
  // than hand-trimming the prose: the fixtures stay readable here, and what
  // lands in the table matches what a real scraped row looks like.
  description: clampBillDescription(b.description),
  contentHash: hash(b.title + b.fullText),
  versions: [],
}));

const govContent = [
  {
    title: "Executive Order on Strengthening American Cybersecurity",
    type: "Executive Order",
    publishedDate: daysAgo(15),
    description:
      "Directs federal agencies to adopt zero-trust security architectures and establishes new incident reporting requirements for critical infrastructure operators.",
    fullText:
      "By the authority vested in me as President by the Constitution and the laws of the United States of America, it is hereby ordered as follows: Section 1. Policy. The United States faces persistent and increasingly sophisticated malicious cyber campaigns...",
    aiGeneratedArticle: `# What This Means For You
Federal agencies will be required to significantly upgrade their cybersecurity, and companies that run critical infrastructure like power grids and water systems will face new reporting requirements when they're hacked.

# Overview
This executive order represents the most significant federal cybersecurity directive in years. It mandates that all federal agencies transition to zero-trust security architectures within 18 months, a model that assumes no user or system should be automatically trusted. The order also requires critical infrastructure operators to report cyber incidents to CISA within 72 hours.

Additionally, the order establishes a Cyber Safety Review Board modeled on the NTSB, which will investigate major cyber incidents and publish findings. Federal contractors handling sensitive data will face stricter security requirements in their contracts.

# Impact & Implications
Federal employees will notice changes in how they access systems, with more frequent authentication checks and restricted access based on need-to-know principles. Companies in energy, healthcare, finance, and transportation sectors will need to invest in incident detection and reporting capabilities. The cybersecurity industry will see increased demand for zero-trust solutions and compliance consulting.

# The Debate
Cybersecurity experts broadly support the order, though some question whether the 18-month timeline for zero-trust adoption is realistic. Industry groups worry about compliance costs, particularly for smaller operators. Privacy advocates praise the transparency measures but want stronger protections for the incident data that companies will be required to share with the government.`,
    thumbnailUrl: "https://picsum.photos/seed/cyber/800/600",
    images: [],
    url: "https://www.whitehouse.gov/presidential-actions/executive-order-cybersecurity-2025/",
    source: "whitehouse.gov",
  },
  {
    title: "Memorandum on Modernizing Federal Student Loan Servicing",
    type: "Memorandum",
    publishedDate: daysAgo(8),
    description:
      "Directs the Department of Education to overhaul the federal student loan servicing system and improve borrower experience.",
    fullText:
      "MEMORANDUM FOR THE SECRETARY OF EDUCATION. SUBJECT: Modernizing Federal Student Loan Servicing. By the authority vested in me as President, I hereby direct the following actions to improve the federal student loan servicing system...",
    aiGeneratedArticle: `# What This Means For You
If you have federal student loans, the government is overhauling the system you use to manage and repay them, with the goal of ending the billing errors and customer service nightmares that millions of borrowers have experienced.

# Overview
This presidential memorandum directs the Department of Education to modernize the federal student loan servicing system from the ground up. The directive comes after years of complaints about billing errors, misapplied payments, and inadequate customer service from federal loan servicers.

Key directives include building a single, unified borrower portal, establishing service level agreements with loan servicers that include financial penalties for errors, and creating an independent ombudsman office for borrower complaints.

# Impact & Implications
The 43 million Americans with federal student loans could see significant improvements in their repayment experience. A unified portal would eliminate the confusion of dealing with multiple servicers. Financial penalties for servicer errors could reduce the billing mistakes that have cost borrowers billions in unnecessary interest charges.

# The Debate
Borrower advocates welcome the reforms but question whether they go far enough without broader student loan relief. The loan servicing industry argues that many problems stem from the complexity of federal repayment programs rather than servicer negligence. Some lawmakers want to go further and bring loan servicing in-house at the Department of Education.`,
    thumbnailUrl: "https://picsum.photos/seed/loans/800/600",
    images: [],
    url: "https://www.whitehouse.gov/presidential-actions/memorandum-student-loans-2025/",
    source: "whitehouse.gov",
  },
  {
    title: "Proclamation on National Wildfire Preparedness Month",
    type: "Proclamation",
    publishedDate: daysAgo(5),
    description:
      "Declares May 2025 as National Wildfire Preparedness Month and calls on Americans to take steps to protect their communities.",
    fullText:
      "NOW, THEREFORE, I, the President of the United States of America, by virtue of the authority vested in me by the Constitution and the laws of the United States, do hereby proclaim May 2025 as National Wildfire Preparedness Month...",
    aiGeneratedArticle: `# What This Means For You
If you live in a wildfire-prone area, this proclamation is a call to action to prepare your home and community for fire season, which experts predict will be particularly severe this year.

# Overview
This proclamation designates May 2025 as National Wildfire Preparedness Month, highlighting the growing threat of wildfires across the American West and Southeast. The proclamation cites the record-breaking 2024 fire season, which burned over 8 million acres and caused $30 billion in damages.

The proclamation directs FEMA to expand its community preparedness grants and calls on states to adopt updated building codes for wildfire-prone areas. It also announces a new federal-state partnership to create 100-foot defensible space zones around vulnerable communities.

# Impact & Implications
Homeowners in fire-prone regions may see new building code requirements and incentives for fire-resistant landscaping. Federal preparedness grants could help fund community firebreaks and evacuation planning. The proclamation signals increased federal attention to wildfire as a growing national security issue driven by climate change.

# The Debate
Fire scientists and emergency managers applaud the attention but say preparedness alone is insufficient without addressing the root causes of increasing wildfire severity, including climate change and decades of fire suppression. Some Western state officials bristle at federal building code recommendations, viewing them as overreach into local land use decisions.`,
    thumbnailUrl: "https://picsum.photos/seed/wildfire/800/600",
    images: [],
    url: "https://www.whitehouse.gov/presidential-actions/proclamation-wildfire-2025/",
    source: "whitehouse.gov",
  },
  {
    title: "Statement on the Federal Reserve Interest Rate Decision",
    type: "News Article",
    publishedDate: daysAgo(3),
    description:
      "The White House responds to the Federal Reserve's decision to hold interest rates steady at its May 2025 meeting.",
    fullText:
      "The Federal Reserve announced today that it will maintain the federal funds rate at its current level. The White House issued the following statement...",
    aiGeneratedArticle: `# What This Means For You
Interest rates on mortgages, car loans, and credit cards will stay roughly where they are for now. If you've been waiting for rates to drop before buying a home, you'll need to wait longer.

# Overview
The Federal Reserve held its benchmark interest rate steady at 4.5-4.75% at its May 2025 meeting, citing persistent inflation in services and housing costs. The White House statement expressed confidence in the economy while noting that American families continue to face cost-of-living pressures.

# Impact & Implications
Mortgage rates will likely remain near 6.5%, keeping the housing market sluggish. Savings account yields stay favorable for savers. Business borrowing costs remain elevated, which may slow hiring and expansion plans.

# The Debate
The administration wants lower rates to boost the housing market and economic growth, but the Fed maintains its independence in pursuing its inflation mandate. Critics of the Fed say rates should have been cut already, while inflation hawks argue the hold is prudent given sticky price pressures.`,
    thumbnailUrl: "https://picsum.photos/seed/fed-rates/800/600",
    images: [],
    url: "https://www.whitehouse.gov/briefing-room/statements/fed-rate-decision-may-2025/",
    source: "whitehouse.gov",
  },
].map((g) => ({
  ...g,
  contentHash: hash(g.title + (g.fullText ?? "")),
  versions: [],
}));

const courtCases = [
  {
    caseNumber: "23-1234",
    title: "United States v. Gonzalez",
    court: "Supreme Court of the United States",
    filedDate: daysAgo(90),
    description:
      "Whether the Fourth Amendment requires law enforcement to obtain a warrant before accessing historical cell-site location information spanning more than seven days.",
    status: "Argued",
    fullText:
      "No. 23-1234. UNITED STATES, PETITIONER v. CARLOS GONZALEZ. ON WRIT OF CERTIORARI TO THE UNITED STATES COURT OF APPEALS FOR THE NINTH CIRCUIT. The question presented is whether the Fourth Amendment's warrant requirement, as articulated in Carpenter v. United States, extends to historical cell-site location information...",
    aiGeneratedArticle: `# What This Means For You
The Supreme Court is deciding how much of your phone's location history the police can access without a judge's approval, building on a landmark 2018 case about digital privacy.

# Overview
United States v. Gonzalez asks the Supreme Court to clarify the scope of its 2018 Carpenter decision, which held that accessing seven days of cell-site location information constitutes a Fourth Amendment search. The government argues that Carpenter's seven-day threshold should be a firm rule, while the defendant argues that any access to location data requires a warrant.

The case arose when federal agents obtained 180 days of Gonzalez's cell-site location data through a court order under the Stored Communications Act, which has a lower standard than a traditional warrant. The Ninth Circuit suppressed the evidence, holding that Carpenter's logic extends beyond seven days.

# Impact & Implications
A ruling expanding Carpenter could force law enforcement to obtain warrants for any cell-site data requests, significantly affecting how investigations of drug trafficking, kidnapping, and terrorism are conducted. For ordinary Americans, a broader ruling would strengthen privacy protections for the location data that cell phones constantly generate.

# The Debate
Privacy advocates and civil liberties organizations argue that location data reveals intimate details of a person's life regardless of the time period. Law enforcement groups warn that a warrant requirement for all location data would impede time-sensitive investigations. Tech companies have filed mixed briefs — some supporting stronger privacy protections, others concerned about the compliance burden.`,
    thumbnailUrl: "https://picsum.photos/seed/scotus1/800/600",
    images: [],
    url: "https://www.courtlistener.com/opinion/mock-gonzalez/",
  },
  {
    caseNumber: "24-567",
    title: "National Federation of Teachers v. Department of Education",
    court: "Supreme Court of the United States",
    filedDate: daysAgo(60),
    description:
      "Whether the Department of Education exceeded its statutory authority in promulgating new Title IX regulations that expand the definition of sex-based discrimination.",
    status: "Cert Granted",
    fullText:
      "No. 24-567. NATIONAL FEDERATION OF TEACHERS, et al., PETITIONERS v. DEPARTMENT OF EDUCATION. ON PETITION FOR A WRIT OF CERTIORARI TO THE UNITED STATES COURT OF APPEALS FOR THE SIXTH CIRCUIT...",
    aiGeneratedArticle: `# What This Means For You
The Supreme Court will decide whether the Department of Education went too far in rewriting Title IX rules that govern how schools handle discrimination complaints — a decision that could affect every public school and university in the country.

# Overview
This case challenges the Department of Education's 2024 Title IX regulations, which expanded the definition of sex-based discrimination to include gender identity and sexual orientation. The National Federation of Teachers and several state attorneys general argue that the Department exceeded the authority Congress granted it under Title IX.

The Sixth Circuit upheld the regulations, finding that the Department's interpretation was a reasonable exercise of its rulemaking authority. The Supreme Court granted certiorari to resolve a circuit split, as the Fifth Circuit reached the opposite conclusion in a separate challenge.

# Impact & Implications
The ruling could reshape how schools handle discrimination complaints and could set broader precedent for the limits of executive agency rulemaking power. Schools and universities would need to adjust their policies based on the outcome. The decision could also affect other areas where agencies have expanded statutory definitions through regulation.

# The Debate
Supporters of the regulations argue that Title IX's broad language was always intended to evolve with society's understanding of discrimination. Opponents counter that such a significant policy change should come from Congress, not an executive agency. The case has become a flashpoint in broader debates about executive power, gender identity, and education policy.`,
    thumbnailUrl: "https://picsum.photos/seed/scotus2/800/600",
    images: [],
    url: "https://www.courtlistener.com/opinion/mock-nft-v-doe/",
  },
  {
    caseNumber: "24-890",
    title: "TechCorp Inc. v. California",
    court: "Supreme Court of the United States",
    filedDate: daysAgo(40),
    description:
      "Whether a state law requiring algorithmic transparency for social media platforms violates the First Amendment rights of platform operators.",
    status: "Briefing",
    fullText:
      "No. 24-890. TECHCORP INC., PETITIONER v. STATE OF CALIFORNIA. ON WRIT OF CERTIORARI TO THE SUPREME COURT OF CALIFORNIA. The question presented is whether California's Algorithmic Transparency Act, which requires social media platforms to disclose the factors used in content recommendation algorithms...",
    aiGeneratedArticle: `# What This Means For You
Can your state force social media companies to explain why their algorithms show you the content they show you? The Supreme Court is about to decide.

# Overview
TechCorp Inc. v. California tests whether states can require social media platforms to disclose how their recommendation algorithms work. California's Algorithmic Transparency Act requires platforms with over 10 million users to publish detailed descriptions of the factors their algorithms use to rank and recommend content.

TechCorp argues that its algorithm is protected editorial judgment under the First Amendment, similar to a newspaper's decisions about which stories to feature. California counters that the law is a reasonable commercial disclosure requirement that doesn't compel speech but merely requires transparency about existing practices.

# Impact & Implications
A ruling for California could open the door to algorithmic regulation nationwide, giving users unprecedented insight into why they see certain content. A ruling for TechCorp could shield algorithms from government scrutiny and embolden platforms to resist disclosure requirements. The decision will likely shape the future of tech regulation for years to come.

# The Debate
Free speech advocates are split: some see algorithmic curation as protected expression, while others argue that monopolistic platforms wield too much power over public discourse to claim editorial immunity. Tech companies warn that disclosure could expose trade secrets and make algorithms vulnerable to manipulation. Consumer advocates and regulators argue that transparency is essential for accountability.`,
    thumbnailUrl: "https://picsum.photos/seed/scotus3/800/600",
    images: [],
    url: "https://www.courtlistener.com/opinion/mock-techcorp-v-ca/",
  },
].map((c) => ({
  ...c,
  contentHash: hash(c.title + (c.fullText ?? "")),
  versions: [],
}));

/**
 * Structured briefs for the seeded bills, in the same shape the scraper writes.
 * Seeded so local contributors can see the brief UI without an LLM key — and so
 * the quote-verification contract is visible by example: every `quote.text`
 * below appears verbatim in the matching bill's `fullText`, which is exactly
 * what `verifyBriefQuotes` enforces in the pipeline.
 *
 * Indexed to match `bills` above.
 */
const billBriefs: (Omit<
  BillBriefRecord,
  "generatedAt" | "modelVersion"
> | null)[] = [
  {
    version: 7,
    legalStatus: "proposed",
    verifiedQuotes: 1,
    hook: "If this bill becomes law, states would get **a longer window to plan road and bridge repairs**, while cities could apply for **new public-transit money**. The $200 billion is a maximum, not guaranteed money; Congress would still decide how much can actually be spent each year.",
    facts: [
      {
        label: "Spending limit",
        value: "$200B",
        note: "Maximum over 10 years; Congress must approve spending each year.",
      },
      { label: "Chamber status", value: "Passed House", note: "Senate next." },
      {
        label: "How money is shared",
        value: "State shares + city grants",
        note: "States get set shares; cities apply for separate transit money.",
      },
    ],
    changes: [
      {
        kind: "funds",
        title: "Ten years of road and bridge money for states",
        before:
          "Congress usually approves federal road and transit programs for **only a few years at a time**. That makes long projects harder for states to plan.",
        after:
          "The bill would promise road and bridge money for **ten years**. Each state's share would depend on its **population, road conditions, and public-transit use**.",
        visual: "infrastructure-repair",
        quote: {
          text: "Congress finds that the nation's infrastructure is in critical need of repair and modernization",
          locator: "Sec. 2",
        },
      },
      {
        kind: "creates",
        title: "New money for rail and faster bus service",
        before:
          "Cities now apply for federal transit money through **several programs that also fund other transportation projects**.",
        after:
          "The bill would create a **separate pool of money for light rail and faster bus service**. It would also support rural internet projects.",
        visual: "public-transit",
      },
    ],
    affected: [
      {
        group: "State transportation departments",
        takeaway:
          "States would get a **longer planning window** for multi-year projects.",
        effect:
          "State agencies could plan projects farther ahead because federal road and bridge support would be set for **ten years**. Federal officials would have fewer chances to approve projects one by one.",
        direction: "gains",
      },
      {
        group: "Transit riders in mid-size cities",
        takeaway:
          "Whether riders benefit would depend on **which cities receive grants**.",
        effect:
          "New money could pay for transit expansions, but **the final rules would decide which cities can apply and receive it**.",
        direction: "unclear",
      },
    ],
    unknowns: [
      "The bill does not say **how much each factor would count** when dividing road and bridge money among states.",
      "Congress would still need to **approve the actual spending each year**, so the full $200 billion is not guaranteed.",
      "The bill itself **does not support the job estimates** cited by its sponsors.",
    ],
    terms: [
      {
        term: "Authorization",
        plain:
          "Congress sets a maximum amount a program may spend. This **does not provide the money by itself**; Congress must approve the actual spending later.",
      },
    ],
    whyNotBefore: {
      summary:
        "Congress already funds highways and transit in multi-year laws. The recurring disputes are **how long to promise money, which programs receive it, and how to pay for it**.",
      points: [
        {
          text: "Recent transportation laws have generally lasted **about five years, not ten**. Several earlier laws expired before Congress agreed on replacements, so lawmakers temporarily extended the old programs while negotiations continued.",
          citations: [
            {
              title:
                "Surface Transportation Reauthorization: Federal Highway Programs",
              publisher: "Congressional Research Service",
              url: "https://www.congress.gov/crs-product/R48845",
            },
          ],
        },
        {
          text: "A longer promise also raises the question of how to pay for it. **Federal fuel-tax revenue has not kept pace with planned spending**, and Congress has repeatedly transferred other federal money into the Highway Trust Fund.",
          citations: [
            {
              title:
                "Funding and Financing Highways and Public Transportation Under the Infrastructure Investment and Jobs Act",
              publisher: "Congressional Research Service",
              url: "https://www.congress.gov/crs-product/R47573",
            },
          ],
        },
      ],
    },
    deepDive: {
      title: "Why the $200 billion is not guaranteed",
      dek: "The bill could set a ten-year plan **without putting the full amount in agencies' bank accounts**.",
      body: "## The short answer\n\nThe bill would let Congress spend as much as **$200 billion over ten years** on the programs it creates. That number is a limit, not a deposit. Federal agencies could not start spending the entire amount simply because this bill passed.\n\nCongress would still make a separate spending decision—usually each year—to determine how much money agencies can actually use. It could approve the full amount, a smaller amount, or no money for a particular year.\n\n## Why write a large number into the bill?\n\nA ten-year limit tells states and federal agencies how large Congress expects the program could become. That can help them prepare project lists, hire staff, and plan repairs that take several years.\n\nBut planning certainty is not the same as cash. A future Congress could face different priorities, a recession, an emergency, or a dispute over the federal budget. Any of those could lead lawmakers to approve less money than the bill allows.\n\n## What should readers watch next?\n\nIf this bill moves forward, the next important documents would be the yearly spending bills. Those would show whether Congress is turning the headline promise into money that states and cities can actually use.\n\nThe useful question is not only, **“Did Congress pass the infrastructure bill?”** It is also, **“How much did Congress approve for these programs this year?”**",
    },
    reading: [
      {
        title: "Overview of the Authorization-Appropriations Process",
        publisher: "Congressional Research Service",
        url: "https://www.congress.gov/crs-product/RS20371",
        whyRead:
          "A short, nonpartisan explanation of why **creating a program and paying for it are separate votes**.",
      },
      {
        title: "Authorizations and the Appropriations Process",
        publisher: "Congressional Research Service",
        url: "https://www.congress.gov/crs-product/R46497",
        whyRead:
          "A fuller guide to how Congress **sets spending limits and later approves usable money**.",
      },
    ],
  },
  {
    version: 7,
    legalStatus: "proposed",
    verifiedQuotes: 2,
    hook: "If passed, the bill would require companies to **get permission before collecting or selling personal data**. People across the country could also **review and delete information held about them**, although the text does not settle whether **stronger state privacy laws** would remain in place.",
    facts: [{ label: "Chamber status", value: "In Committee" }],
    changes: [
      {
        kind: "requires",
        title: "Companies would need permission before collecting data",
        before:
          "Different federal rules cover health, financial, and children's data. **Most other personal data has no nationwide permission rule**.",
        after:
          "Companies would have to **ask before collecting or selling most personal information**.",
        visual: "data-privacy",
        quote: {
          text: "The purpose of this Act is to establish comprehensive federal data privacy protections",
          locator: "Sec. 2",
        },
      },
      {
        kind: "creates",
        title: "People could see and delete data held about them",
        before:
          "A person's ability to see or delete company-held data **depends on the company and their state**.",
        after:
          "People across the country would gain the **right to review and delete personal data** held about them.",
        visual: "data-control",
        quote: {
          text: "A covered entity shall provide an individual with the right to access and delete personal data collected about the individual",
          locator: "Sec. 3",
        },
      },
    ],
    affected: [
      {
        group: "People whose data is collected online",
        takeaway:
          "People would gain federal rights to **review and delete their data**.",
        effect:
          "They could **see and delete personal information** that companies hold, and companies would have to ask before collecting it.",
        direction: "gains",
      },
      {
        group: "Companies that buy and sell consumer data",
        takeaway:
          "Data brokers would have to ask permission and **honor access or deletion requests**.",
        effect:
          "They would have to **ask permission, explain what they collect, and delete data when required**. Companies built around selling data would face the biggest changes.",
        direction: "loses",
      },
      {
        group: "States with their own privacy laws",
        takeaway:
          "State protections could **remain or be replaced** by the federal standard.",
        effect:
          "Residents' protection would depend on whether the federal rules **add to or replace stronger state laws**.",
        direction: "unclear",
      },
    ],
    unknowns: [
      "The excerpt does not say whether **federal rules would replace stronger state privacy laws**.",
      "The excerpt does not explain **who would enforce the rules**: a government agency, individuals filing lawsuits, or both.",
    ],
    terms: [
      {
        term: "Preemption",
        plain:
          "When a federal law **overrides and replaces state laws** on the same subject rather than adding to them.",
      },
    ],
    whyNotBefore: {
      summary:
        "Congress has considered nationwide privacy rules for years, but earlier proposals **did not resolve the role of stronger state laws or private lawsuits**.",
      points: [
        {
          text: "Federal privacy law has mostly covered particular industries and types of data, while states built broader consumer rules. Past proposals **disagreed over whether stronger state laws would remain in force**.",
          citations: [
            {
              title: "Preemption and Privacy Law",
              publisher: "Congressional Research Service",
              url: "https://www.congress.gov/crs-product/R48667",
            },
          ],
        },
        {
          text: "Earlier comprehensive bills also **differed over who could enforce them**. Some would have allowed individuals to sue in certain circumstances, while others relied more heavily on government enforcement.",
          citations: [
            {
              title: "Overview of the American Data Privacy and Protection Act",
              publisher: "Congressional Research Service",
              url: "https://www.congress.gov/crs-product/LSB10776",
            },
          ],
        },
      ],
    },
    reading: [],
  },
];

/**
 * The brief explains mechanics; the dual lens preserves the disagreement.
 * Keep both in local fixtures so a brief can never make the product's
 * signature compare-the-cases layer appear to have vanished.
 */
const billLenses = [
  {
    framing: "proponent_opponent" as const,
    left: {
      stance: "Plan farther ahead",
      points: [
        {
          text: "Promising money for ten years could help states plan repairs that take several years to finish.",
          example: {
            fact: "The Interstate Highway System used a multi-year federal funding commitment to support construction across many states.",
            relevance:
              "That long commitment gave states a stable federal partner for projects that took years to plan and build.",
          },
          sourceIds: [1, 2],
        },
        {
          text: "A separate pool of federal money could help more cities expand rail and faster bus service.",
          example: {
            fact: "Federal Capital Investment Grants already support light rail and bus rapid transit projects in cities across the country.",
            relevance:
              "Those projects show that a separate transit grant program can turn federal money into specific local rail and bus expansions.",
          },
          sourceIds: [1, 3],
        },
      ],
    },
    right: {
      stance: "Keep spending review frequent",
      points: [
        {
          text: "The $200 billion is only a limit. Congress would still decide how much money to approve each year.",
          example: {
            fact: "The current transit grant program separates $3 billion allowed each year from $1.6 billion provided up front.",
            relevance:
              "The difference shows why a spending limit is not the same as guaranteed money: Congress still has to approve much of it later.",
          },
          sourceIds: [1, 3],
        },
        {
          text: "A ten-year plan gives Congress fewer automatic chances to reconsider how the money is divided.",
          example: {
            fact: "The 2021 infrastructure law listed transit grant funding for five years, from 2022 through 2026.",
            relevance:
              "That shorter schedule returned the program to Congress sooner than this proposal's ten-year schedule would.",
          },
          sourceIds: [1, 3],
        },
      ],
    },
    sources: [
      {
        id: 1,
        title: "Infrastructure Modernization Act of 2025 — official text",
        url: bills[0]!.url,
      },
      {
        id: 2,
        title: "Interstate System funding history — FHWA",
        url: "https://www.fhwa.dot.gov/highwayhistory/data/page01.cfm",
      },
      {
        id: 3,
        title: "Capital Investment Grants program — FTA",
        url: "https://www.transit.dot.gov/funding/grants/fact-sheet-capital-investment-grants-program",
      },
    ],
  },
  {
    framing: "proponent_opponent" as const,
    left: {
      stance: "Create one national privacy floor",
      points: [
        {
          text: "A national rule would give people in every state the same basic rights to view and delete their data.",
          example: {
            fact: "California residents can already ask businesses to show or delete personal information collected about them.",
            relevance:
              "California demonstrates how these rights work in practice; this bill would extend similar access and deletion rights nationwide.",
          },
          sourceIds: [1, 2],
        },
      ],
    },
    right: {
      stance: "Preserve stronger state rules",
      points: [
        {
          text: "The excerpt does not guarantee that stronger state privacy rights would stay in place.",
          example: {
            fact: "California lets residents limit businesses' use of precise location and genetic data.",
            relevance:
              "The proposal excerpt creates nationwide access and deletion rights but does not expressly preserve California's additional limit-use right. That specific gap is why opponents worry state protections could be reduced.",
          },
          sourceIds: [1, 2],
        },
      ],
    },
    sources: [
      {
        id: 1,
        title: "Digital Privacy Protection Act — official text",
        url: bills[1]!.url,
      },
      {
        id: 2,
        title: "California Consumer Privacy Act — consumer rights",
        url: "https://oag.ca.gov/privacy/ccpa",
      },
    ],
  },
];

async function seed() {
  assertSeedTargetIsLocal();

  console.log("Seeding database...\n");

  console.log("Inserting bills...");
  const insertedBills = await db
    .insert(Bill)
    .values(bills)
    .onConflictDoNothing()
    .returning({
      id: Bill.id,
      title: Bill.title,
      contentHash: Bill.contentHash,
    });
  console.log(`  ${insertedBills.length} bills inserted`);

  // Resolve every fixture after the insert instead of relying on RETURNING.
  // RETURNING only includes newly inserted rows, which meant re-running the
  // seed against an existing local database never added or refreshed briefs.
  const seededBills = await db
    .select({
      id: Bill.id,
      billNumber: Bill.billNumber,
      contentHash: Bill.contentHash,
    })
    .from(Bill)
    .where(
      and(
        eq(Bill.sourceWebsite, "congress.gov"),
        inArray(
          Bill.billNumber,
          bills.map((bill) => bill.billNumber),
        ),
      ),
    );

  console.log("Inserting bill briefs...");
  const briefRecords = seededBills.flatMap((bill) => {
    const fixtureIndex = bills.findIndex(
      (fixture) => fixture.billNumber === bill.billNumber,
    );
    const brief = billBriefs[fixtureIndex];
    return brief
      ? [
          {
            contentType: "bill" as const,
            contentId: bill.id,
            contentHash: bill.contentHash,
            brief: {
              ...brief,
              generatedAt: now.toISOString(),
              modelVersion: "seed",
            },
            modelVersion: "seed",
          },
        ]
      : [];
  });
  if (briefRecords.length === 0) {
    console.log("  0 briefs inserted (no new bills to link)");
  } else {
    const insertedBriefs = await db
      .insert(ContentBrief)
      .values(briefRecords)
      .onConflictDoUpdate({
        target: [ContentBrief.contentType, ContentBrief.contentId],
        set: {
          contentHash: sql`excluded.content_hash`,
          brief: sql`excluded.brief`,
          modelVersion: sql`excluded.model_version`,
          updatedAt: now,
        },
      })
      .returning({ id: ContentBrief.id });
    console.log(`  ${insertedBriefs.length} briefs inserted or refreshed`);
  }

  console.log("Inserting bill dual lenses...");
  const lensRecords = seededBills.flatMap((bill) => {
    const fixtureIndex = bills.findIndex(
      (fixture) => fixture.billNumber === bill.billNumber,
    );
    const lensData = billLenses[fixtureIndex];
    return lensData
      ? [
          {
            contentType: "bill" as const,
            contentId: bill.id,
            contentHash: bill.contentHash,
            lensData: {
              ...lensData,
              generatedAt: now.toISOString(),
              modelVersion: "seed",
            },
            modelVersion: "seed",
          },
        ]
      : [];
  });
  if (lensRecords.length === 0) {
    console.log("  0 dual lenses inserted (no seeded bills to link)");
  } else {
    const insertedLenses = await db
      .insert(ContentLens)
      .values(lensRecords)
      .onConflictDoUpdate({
        target: [ContentLens.contentType, ContentLens.contentId],
        set: {
          contentHash: sql`excluded.content_hash`,
          lensData: sql`excluded.lens_data`,
          modelVersion: sql`excluded.model_version`,
          updatedAt: now,
        },
      })
      .returning({ id: ContentLens.id });
    console.log(`  ${insertedLenses.length} dual lenses inserted or refreshed`);
  }

  console.log("Inserting government content...");
  const insertedGov = await db
    .insert(GovernmentContent)
    .values(govContent)
    .onConflictDoNothing()
    .returning({
      id: GovernmentContent.id,
      title: GovernmentContent.title,
      contentHash: GovernmentContent.contentHash,
    });
  console.log(`  ${insertedGov.length} government content items inserted`);

  console.log("Inserting court cases...");
  const insertedCases = await db
    .insert(CourtCase)
    .values(courtCases)
    .onConflictDoNothing()
    .returning({
      id: CourtCase.id,
      title: CourtCase.title,
      contentHash: CourtCase.contentHash,
    });
  console.log(`  ${insertedCases.length} court cases inserted`);

  console.log("Inserting videos (feed items)...");
  const videoRecords = [
    ...insertedBills.map((b, i) => ({
      contentType: "bill" as const,
      contentId: b.id,
      title: bills[i]!.title.slice(0, 100),
      description: bills[i]!.description!,
      thumbnailUrl: bills[i]!.thumbnailUrl,
      author: "congress.gov",
      engagementMetrics: {
        likes: Math.floor(1000 + i * 2345),
        comments: Math.floor(100 + i * 234),
        shares: Math.floor(50 + i * 123),
      },
      sourceContentHash: b.contentHash,
    })),
    ...insertedGov.map((g, i) => ({
      contentType: "government_content" as const,
      contentId: g.id,
      title: govContent[i]!.title.slice(0, 100),
      description: govContent[i]!.description!,
      thumbnailUrl: govContent[i]!.thumbnailUrl,
      author: govContent[i]!.source,
      engagementMetrics: {
        likes: Math.floor(2000 + i * 1567),
        comments: Math.floor(200 + i * 345),
        shares: Math.floor(100 + i * 234),
      },
      sourceContentHash: g.contentHash,
    })),
    ...insertedCases.map((c, i) => ({
      contentType: "court_case" as const,
      contentId: c.id,
      title: courtCases[i]!.title.slice(0, 100),
      description: courtCases[i]!.description!,
      thumbnailUrl: courtCases[i]!.thumbnailUrl,
      author: "courtlistener.com",
      engagementMetrics: {
        likes: Math.floor(3000 + i * 1234),
        comments: Math.floor(300 + i * 456),
        shares: Math.floor(150 + i * 345),
      },
      sourceContentHash: c.contentHash,
    })),
  ];

  if (videoRecords.length === 0) {
    console.log("  0 videos inserted (no new content to link)");
  } else {
    const insertedVideos = await db
      .insert(Video)
      .values(videoRecords)
      .onConflictDoNothing()
      .returning({ id: Video.id });
    console.log(`  ${insertedVideos.length} videos inserted`);
  }

  console.log(
    `\nDone! Seeded ${insertedBills.length} bills, ${insertedGov.length} gov content, ${insertedCases.length} court cases, ${videoRecords.length} videos.`,
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
