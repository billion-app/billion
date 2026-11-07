import { load } from "cheerio";
import { extractText } from "unpdf";

import {
  regionalMeasuresPayloadSchema,
  regionalSourceUrl,
  RTM_COUNTIES,
} from "@acme/api/lib/regional-measures-cache";

import { fetchWithRetry } from "../utils/fetch.js";

export const RTM_DISTRICT_URL =
  "https://mtc.ca.gov/about-mtc/authorities/public-transit-revenue-measure-district";
export const RTM_COUNTY_URL =
  "https://smcacre.gov/elections/november-3-2026-statewide-general-election";
// Reviewed against the resolution PDF page 8, printed page 7. Its text layer
// misreads the commas after "everyone" and "workers" as periods.
const REVIEWED_BALLOT_QUESTION =
  "To prevent major service cuts to BART and other transit, avoid increased traffic, and reduce pollution by: Preserving BART, Caltrain, VTA, SamTrans, AC Transit, Muni, other transit for everyone, including workers, students, seniors, persons with disabilities; Supporting transit safety, cleanliness, affordability, reliability; Repairing targeted roads/potholes; Requiring financial transparency, oversight, accountability; shall the measure enacting a 0.5% (Alameda, Contra Costa, San Mateo, Santa Clara counties), and 1% (San Francisco) sales tax for 14 years generating approximately $980,000,000 annually, be adopted?";
const EXTRACTED_BALLOT_QUESTION = REVIEWED_BALLOT_QUESTION.replace(
  "everyone, including workers, students",
  "everyone. including workers. students",
);

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

export function regionalDocumentLinks(html: string) {
  const $ = load(html);
  const heading = $("h5").filter((_, el) =>
    /Regional Transit Measure.*Public Transit Revenue Measure District/i.test(
      $(el).text(),
    ),
  );
  if (heading.length !== 1)
    throw new Error("Regional transit measure section missing or ambiguous");
  const links = heading.nextUntil("h2,h3,h4,h5").find("a[href]").toArray();
  const find = (label: RegExp) => {
    const matches = links.filter((link) =>
      label.test(normalize($(link).text())),
    );
    if (matches.length !== 1)
      throw new Error(`Expected one regional document for ${label}`);
    const href = new URL($(matches[0]!).attr("href")!, RTM_COUNTY_URL);
    const document = href.searchParams.get("document");
    const url = regionalSourceUrl.parse(document ?? href.href);
    if (!new URL(url).pathname.endsWith(".pdf"))
      throw new Error("Regional source is not a PDF");
    return url;
  };
  return {
    fullTextUrl: find(/^Resolution and Full Text$/i),
    analysisUrl: find(/^Impartial Analysis$/i),
    argumentForUrl: find(/^Primary Argument in Favor$/i),
    argumentAgainstUrl: find(/^Primary Argument Against$/i),
  };
}

export function parseRegionalMeasure(
  districtHtml: string,
  countyHtml: string,
  fullText: string,
  fetchedAt = new Date(),
) {
  const $ = load(districtHtml);
  const body = $(".field-name-field-body");
  const overview = body
    .children("p")
    .filter((_, el) =>
      /District on Jan\. 16, 2026 received a notice of intent/.test(
        $(el).text(),
      ),
    );
  const districtText = normalize(body.text());
  if (
    overview.length !== 1 ||
    !districtText.includes("November 3, 2026") ||
    !RTM_COUNTIES.every((county) => districtText.includes(county))
  )
    throw new Error(
      "Regional district identity, election or county scope changed",
    );
  const question = /To prevent major service cuts[\s\S]*?be adopted\?/.exec(
    fullText,
  )?.[0];
  if (
    !question ||
    !fullText.includes("PUBLIC TRANSIT REVENUE MEASURE DISTRICT") ||
    !fullText.includes("November 3, 2026")
  )
    throw new Error("Regional legal text or ballot question missing");
  const extractedQuestion = normalize(question);
  if (
    extractedQuestion !== REVIEWED_BALLOT_QUESTION &&
    extractedQuestion !== EXTRACTED_BALLOT_QUESTION
  )
    throw new Error("Regional ballot question changed; source review required");
  return regionalMeasuresPayloadSchema.parse({
    electionDate: "2026-11-03",
    fetchedAt: fetchedAt.toISOString(),
    complete: true,
    measures: [
      {
        id: "ca-ptrmd-2026-11-03-rtm",
        designation: "RTM",
        title: "Regional Transit Measure",
        districtName: "Public Transit Revenue Measure District",
        counties: [...RTM_COUNTIES],
        sourceName: "Public Transit Revenue Measure District",
        sourceUrl: RTM_DISTRICT_URL,
        officialOverview: normalize(overview.text()),
        ballotQuestion: REVIEWED_BALLOT_QUESTION,
        fullText,
        ...regionalDocumentLinks(countyHtml),
      },
    ],
  });
}

async function readSource(url: string, maxBytes: number): Promise<Uint8Array> {
  regionalSourceUrl.parse(url);
  const response = await fetchWithRetry(url, {
    redirect: "error",
    headers: { "User-Agent": "BillionCivicBot/1.0 (+https://billion.app)" },
  });
  if (!response.ok || !response.body)
    throw new Error(`Regional source HTTP ${response.status}`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error("Regional source exceeds byte limit");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function collectRegionalMeasures(maxItems = 1) {
  if (maxItems !== 1)
    throw new Error("Regional collection requires maxItems=1");
  const [district, county] = await Promise.all(
    [RTM_DISTRICT_URL, RTM_COUNTY_URL].map(async (url) =>
      Buffer.from(await readSource(url, 1_000_000)).toString("utf8"),
    ),
  );
  const { fullTextUrl } = regionalDocumentLinks(county!);
  const bytes = await readSource(fullTextUrl, 15_000_000);
  if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-")
    throw new Error("Regional legal document is not a PDF");
  const fullText = (
    await extractText(new Uint8Array(bytes), { mergePages: true })
  ).text;
  return parseRegionalMeasure(district!, county!, fullText);
}
