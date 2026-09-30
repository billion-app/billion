import { createHash } from "node:crypto";
import { load } from "cheerio";

import type { CountyLocations } from "@acme/api/lib/voting-logistics/county-locations-cache";
import {
  countyLocationsSchema,
  SANTA_CRUZ_JURISDICTION,
} from "@acme/api/lib/voting-logistics/county-locations-cache";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
export function parseSantaCruzLocations(
  html: string,
  sourceUrl: string,
  electionDate: string,
): CountyLocations {
  const $ = load(html);
  const title = clean($(".subtitle").text());
  const match =
    /^(\w+) (\d{1,2}), (\d{4}) California (?:Primary|General) Election$/.exec(
      title,
    );
  if (
    !match ||
    new Date(`${match[1]} ${match[2]}, ${match[3]} 12:00 GMT`)
      .toISOString()
      .slice(0, 10) !== electionDate
  )
    throw new Error("County source election does not match requested date");
  const u = new URL(sourceUrl);
  const cycle = `${match[1]}${match[2]},${match[3]}California${title.includes("Primary") ? "Primary" : "General"}Election`;
  if (
    u.origin !== "https://votescount.santacruzcountyca.gov" ||
    u.username ||
    u.password ||
    u.pathname !== `/Home/Elections/${cycle}/VoteCenterDropBoxLocations.aspx`
  )
    throw new Error("Expected matching official county election URL");
  const locations: CountyLocations["locations"] = [];
  const electionHours = $("p")
    .toArray()
    .map((el) => clean($(el).text()))
    .find((text) =>
      /^All centers will be open for voting on Election Day/.test(text),
    );
  if (!electionHours) throw new Error("Missing election-day hours");
  $("h4").each((_, heading) => {
    const schedule = clean($(heading).text());
    const days = /^(29|11|4|1) Day Vote Centers\./.exec(schedule);
    if (!days) return;
    const dateParts =
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/.exec(
        schedule,
      );
    if (!dateParts) throw new Error("Missing location opening date");
    const opening = new Date(
      `${dateParts[1]} ${dateParts[2]}, ${electionDate.slice(0, 4)} 12:00 GMT`,
    ).getTime();
    const end = new Date(`${electionDate}T12:00:00Z`).getTime();
    const delta = (end - opening) / 86400000;
    if (
      !Number.isFinite(delta) ||
      delta < 0 ||
      delta > 35 ||
      (days[1] === "1" && delta !== 0)
    )
      throw new Error("Location schedule belongs to a different election");
    const list = $(heading).next("ul");
    if (!list.length) throw new Error("Vote center list missing");
    list.children("li").each((_, li) => {
      const item = $(li);
      const anchor = item.children("a").first();
      const addressLine = clean(anchor.text());
      const split = /^(.+?),\s*(\d.+)$/.exec(addressLine);
      const city = clean(item.clone().children().remove().end().text()).split(
        /\s+-\s*/,
      )[0];
      if (!split || !city)
        throw new Error("Unrecognized county location address");
      const notesNode = item.clone();
      notesNode.children("a").remove();
      const notes = clean(notesNode.text())
        .replace(new RegExp(`^${city}\\s*-\\s*`), "")
        .replace(/^\.\s*/, "");
      locations.push({
        name: split[1]!,
        line1: split[2]!,
        city,
        state: "CA",
        earlyVoting: days[1] !== "1",
        schedule: `${schedule} ${electionHours}`,
        notes,
        sourceUrl,
      });
    });
  });
  if (
    new Set(locations.map((x) => `${x.name}|${x.line1}`)).size !==
    locations.length
  )
    throw new Error("Duplicate county locations");
  return countyLocationsSchema.parse({
    electionDate,
    jurisdiction: SANTA_CRUZ_JURISDICTION,
    sourceUrl,
    sourceName: "Santa Cruz County Elections",
    fetchedAt: new Date().toISOString(),
    checksum: createHash("sha256").update(html).digest("hex"),
    coverage: "published_vote_centers_only",
    locations,
  });
}
