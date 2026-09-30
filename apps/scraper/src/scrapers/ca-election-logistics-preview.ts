/** Read-only source inspection: no database imports or writes. */
import {
  electionDateFromUrl,
  parseCaElectionLogistics,
} from "./ca-election-logistics-parser.js";
import { fetchCaElectionPage } from "./ca-election-logistics-source.js";

const url = process.argv[2];
if (!url) throw new Error("Pass the official election-specific key-dates URL");
electionDateFromUrl(url);
console.log(
  JSON.stringify(
    parseCaElectionLogistics(await fetchCaElectionPage(url), url),
    null,
    2,
  ),
);
