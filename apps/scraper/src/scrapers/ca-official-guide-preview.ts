import { collectOfficialGuide } from "./ca-official-guide-source.js";

// This entry imports no database client and never persists the preview.
const [electionDate, limit = "1"] = process.argv.slice(2);
if (!electionDate)
  throw new Error("Usage: ca-official-guide-preview.ts YYYY-MM-DD [max-pages]");
const payload = await collectOfficialGuide(electionDate, Number(limit));
console.log(JSON.stringify(payload, null, 2));
