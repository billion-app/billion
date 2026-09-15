import { collectSantaCruzLocations } from "./santa-cruz-locations-source.js";

const [url, date] = process.argv.slice(2);
if (!url || !date)
  throw new Error("Pass official location page URL and exact election date");
console.log(
  JSON.stringify(await collectSantaCruzLocations(url, date), null, 2),
);
