import { load } from "cheerio";

export const campaignPublisherDisclosureMarker =
  "\nCampaign publisher disclosure (identity only):\n";
export function htmlSourceText(html: string) {
  const $ = load(html);
  $("script,style,nav,footer,noscript").remove();
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  const main = normalize($("main").text());
  return main.length >= 20 ? main : normalize($("body").text());
}
export function formatCampaignHtml(html: string, url: string) {
  const $ = load(html);
  const links: string[] = [];
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const label = $(element).text().replace(/\s+/g, " ").trim();
    if (!href || !label || links.length >= 200) return;
    try {
      const target = new URL(href, url);
      if (/^https?:$/.test(target.protocol))
        links.push(`${label} => ${target.toString()}`);
    } catch {
      return;
    }
  });
  const substantive = htmlSourceText(html);
  $("blockquote,q,script,style,noscript").remove();
  const disclosures = $(
    "footer,[role=contentinfo],[class*=disclaimer],[id*=disclaimer]",
  )
    .toArray()
    .filter((element) => !$(element).parents("article").length)
    .flatMap((element) => {
      const block = $(element).clone();
      block
        .find("p,div,section,address,li,h1,h2,h3,h4,h5,h6")
        .prepend(" ")
        .append(" ");
      block.find("br").replaceWith(" ");
      const value = block.text().replace(/\s+/g, " ").trim();
      const offset =
        /\b(?:Paid for by|Authorized (?:and paid for )?by)\b/i.exec(
          value,
        )?.index;
      if (
        offset === undefined ||
        /["“”]|(?<![\p{L}\p{N}])['‘’]|['‘’](?![\p{L}\p{N}])|\b(?:says?|said|reports?|quoted?|according to)\b/iu.test(
          value.slice(0, offset),
        )
      )
        return [];
      return [value.slice(offset)];
    });
  const text =
    substantive +
    "\nLinked source navigation (discovery only):\n" +
    links.join("\n") +
    campaignPublisherDisclosureMarker +
    [...new Set(disclosures)].join("\n");
  return { text, substantive, links, disclosures: [...new Set(disclosures)] };
}
