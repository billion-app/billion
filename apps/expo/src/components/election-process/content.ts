/** Hand-authored educational summaries, not live contest or candidate records. */
export const processExamples = {
  president: {
    label: "President",
    context: "2028 presidential nomination · U.S. example",
    choosing:
      "A nomination chooses a party’s candidate. It does not elect the president.",
    participation:
      "Your state and party set participation rules. Check registration, party affiliation and the published rules for that election; an address alone cannot establish eligibility.",
    steps: [
      [
        "Primary or caucus",
        "A primary is a ballot vote; a caucus is a party-run meeting. Voter preferences help determine delegates under state and party rules.",
      ],
      [
        "Delegates and convention",
        "Delegates represent states in a party’s nomination process. The convention selects the presidential nominee under party rules.",
      ],
      [
        "General election",
        "Voters choose among presidential tickets. The Electoral College, rather than a nationwide popular-vote total, determines the presidency.",
      ],
    ],
    deeper:
      "Discussion by others is speculation. A public declaration says someone intends to run. An FEC filing records federal campaign registration; it does not establish state ballot access. Verified ballot access needs the election authority’s dated record. Nomination needs the party’s dated official record. Billion has no verified 2028 roster, stage or schedule here.",
    sources: [
      [
        "USAGov · primaries and caucuses",
        "https://www.usa.gov/primaries-caucuses",
      ],
      ["USAGov · conventions", "https://www.usa.gov/national-conventions"],
      ["USAGov · Electoral College", "https://www.usa.gov/electoral-college"],
      [
        "FEC · candidate registration",
        "https://www.fec.gov/help-candidates-and-committees/registering-candidate/",
      ],
    ],
    action: [
      "Find my state election office",
      "https://www.usa.gov/state-election-office",
    ],
  },
  california: {
    label: "California",
    context: "2026 U.S. House · California regular-election example",
    choosing:
      "The primary narrows the field to two candidates. The general election chooses your district’s representative in Congress.",
    participation:
      "Registered voters can choose any candidate for this voter-nominated office, regardless of party preference. Check your registration and district with California; this example is not your ballot.",
    steps: [
      [
        "Top-two primary",
        "Candidates share one primary ballot. The two with the most votes advance, even if they prefer the same party.",
      ],
      [
        "General election",
        "Voters choose between the advancing candidates for the office. A party is not guaranteed a place on this ballot.",
      ],
    ],
    deeper:
      "California calls congressional offices voter-nominated offices. This top-two path does not apply to president, county central committees or local offices. A special election fills a vacancy and can have a different schedule and qualifying rules; consult its specific official notice.",
    sources: [
      [
        "California SOS · primary systems",
        "https://www.sos.ca.gov/elections/primary-elections-california",
      ],
    ],
    action: [
      "Check California registration and party preference",
      "https://voterstatus.sos.ca.gov/",
    ],
  },
  texas: {
    label: "Texas",
    context: "2026 U.S. House · Texas party-primary example",
    choosing:
      "A party primary selects that party’s nominee. The general election chooses the district’s representative from the candidates on its ballot.",
    participation:
      "Texas does not register voters by party. Voting in a party’s primary affiliates you with that party for that voting year. You cannot vote in both parties’ primaries or switch parties for the runoff.",
    steps: [
      [
        "Party primary",
        "Voters participate in one party’s primary to choose its nominee. This differs from California’s shared top-two ballot.",
      ],
      [
        "Runoff, if needed",
        "A runoff is another vote when no primary candidate receives a majority. It decides the party’s nominee.",
      ],
      [
        "General election",
        "Voters choose who will hold office. Nomination and election are separate decisions.",
      ],
    ],
    deeper:
      "Other parties may nominate by convention, and independent candidates have separate ballot-access requirements. A special election fills a vacancy; do not assume this regular party-primary path or its dates apply.",
    sources: [
      [
        "Texas SOS · 2026 candidacy and party affiliation FAQs",
        "https://www.sos.texas.gov/elections/candidates/guide/2026/faqs.shtml",
      ],
      [
        "Texas Election Code · primary nomination and runoff (172.003–004)",
        "https://statutes.capitol.texas.gov/Docs/EL/htm/EL.172.htm",
      ],
    ],
    action: [
      "Check Texas registration and election information",
      "https://www.votetexas.gov/",
    ],
  },
} as const;
export type ProcessExample = keyof typeof processExamples;
