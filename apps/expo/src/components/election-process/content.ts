/** Hand-authored educational summaries, not live contest or candidate records. */
export const processExamples = {
  president: {
    label: "President",
    title: "Choosing a president",
    year: "2028",
    choosing:
      "Voters help parties choose their candidates. Then the general election decides who becomes president.",
    participation:
      "Your state and party decide who can take part. Check your registration and whether you need to be registered with a party for that election.",
    steps: [
      [
        "Primary or caucus",
        "A primary is a ballot vote; a caucus is a party meeting. Voters help award delegates — people who vote for the party’s nominee.",
      ],
      [
        "Delegates and convention",
        "At a convention, delegates choose the nominee: the party’s candidate in the general election. State and party rules govern their votes.",
      ],
      [
        "General election",
        "Your vote helps choose your state’s or D.C.’s electors. In the Electoral College, they vote for president and vice president; the nationwide popular-vote total does not elect the president.",
      ],
    ],
    deeper:
      "If no presidential candidate wins a majority of electoral votes, the House of Representatives chooses the president. Discussion by others is speculation. A public declaration says someone intends to run. An FEC filing records federal campaign registration; it does not establish state ballot access. Verified ballot access needs the election authority’s dated record. Nomination needs the party’s dated official record. Billion has no verified 2028 roster, stage or schedule here.",
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
    label: "House: CA",
    title: "California · U.S. House",
    year: "2026",
    choosing:
      "The primary narrows the field to two candidates. The general election chooses your district’s representative in Congress.",
    participation:
      "In this primary, registered voters can choose any candidate, regardless of party preference. Check your registration and district with California.",
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
      "California calls congressional offices voter-nominated offices. This top-two path does not apply to president, county central committees or local offices. A special election fills a vacancy. In a California congressional special primary, a candidate who wins a majority (more than half the votes) can be elected without a special general election. Otherwise, the top two advance. Check the specific official notice for dates and rules.",
    sources: [
      [
        "California SOS · primary systems",
        "https://www.sos.ca.gov/elections/primary-elections-california",
      ],
      [
        "California Election Code · special election majority (10705)",
        "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=ELEC&sectionNum=10705.",
      ],
      [
        "California Election Code · special election advancement (10706)",
        "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=ELEC&sectionNum=10706.",
      ],
    ],
    action: [
      "Check California registration and party preference",
      "https://voterstatus.sos.ca.gov/",
    ],
  },
  texas: {
    label: "House: TX",
    title: "Texas · U.S. House",
    year: "2026",
    choosing:
      "A party primary selects that party’s nominee. The general election chooses the district’s representative from the candidates on its ballot.",
    participation:
      "Texas does not register voters by party. Voting in a party’s primary affiliates you with that party for that voting year. You cannot vote in both parties’ primaries or switch parties for the runoff.",
    steps: [
      [
        "Party primary",
        "Voters in one party’s primary choose that party’s candidate for the general election.",
      ],
      [
        "Runoff, if needed",
        "If no candidate gets more than half the votes, the top two compete in a runoff — another vote to choose the party’s candidate.",
      ],
      [
        "General election",
        "Voters choose which candidate will represent their district in Congress.",
      ],
    ],
    deeper:
      "Primary affiliation does not restrict your choice in the general election. Eligible voters who skipped the primary may still choose a party’s runoff. Other parties may nominate by convention, and independent candidates have separate ballot-access requirements. A special election fills a vacancy; do not assume this regular party-primary path or its dates apply.",
    sources: [
      [
        "Texas SOS · 2026 candidacy and party affiliation FAQs",
        "https://www.sos.texas.gov/elections/candidates/guide/2026/faqs.shtml",
      ],
      [
        "Texas SOS · runoff explanation (May 22, 2026)",
        "https://www.sos.state.tx.us/about/newsreleases/2026/052226.shtml",
      ],
    ],
    action: [
      "Check Texas registration and election information",
      "https://www.votetexas.gov/",
    ],
  },
} as const;
export type ProcessExample = keyof typeof processExamples;
