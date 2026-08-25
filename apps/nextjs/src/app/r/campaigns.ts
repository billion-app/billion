/**
 * Campaign codes for tracked links (`/r?dest=…&p=<code>`).
 *
 * A code is a shorthand for a whole UTM combination, not just a campaign name —
 * so a code can describe any channel, not only the printed flyer. Codes stay
 * short because printed ones are encoded as QR modules, and the readable
 * parameters are expanded here where they can be changed without a reprint.
 */

/** The printed flyer: same source and medium, one campaign per location. */
const printed = (campaign: string) => ({
  utm_source: "flyer",
  utm_medium: "print",
  utm_campaign: campaign,
});

export const CAMPAIGN_CODES: Record<string, Record<string, string>> = {
  // Flyer locations — one printed stack each.
  neighborhood: printed("neighborhood"),
  campus: printed("campus"),
  local_event: printed("local_event"),
  irl_talk: printed("irl_talk"),

  // The short, memorable link used in the Instagram profile bio.
  instagram_bio: {
    utm_source: "instagram",
    utm_medium: "social",
    utm_campaign: "instagram_bio",
  },

  // The install call to action on a shared record's web page (`/b/<id>`).
  // Its own campaign because a reader who arrived from someone else's link is
  // a different acquisition story from one who came off a flyer.
  share_web: {
    utm_source: "share",
    utm_medium: "referral",
    utm_campaign: "share_web",
  },

  // Anything else can set its own combination, e.g.
  // yt_1: { utm_source: "youtube", utm_medium: "video", utm_campaign: "yt_1" },
};

/**
 * UTM parameters for a code.
 *
 * An unmapped code keeps its literal value as the campaign rather than being
 * rejected, so a link can go out before its mapping ships and still report
 * something. It deliberately claims no source or medium — guessing those would
 * put a wrong answer in the data, which is worse than a missing one.
 */
export function campaignFor(code: string): Record<string, string> {
  const known = CAMPAIGN_CODES[code];
  if (known) return known;

  return {
    utm_campaign: /^[a-z0-9_-]{1,32}$/i.test(code) ? code : "unknown",
  };
}
