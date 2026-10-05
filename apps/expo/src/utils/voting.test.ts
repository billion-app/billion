import assert from "node:assert/strict";
import test from "node:test";

import type { PollingLocation, VoterInfoResponse } from "@acme/api";

import type { VotingMethod, VotingMethodId, VotingPlan } from "./voting";
import {
  buildVotingPlan,
  electionPhase,
  entryCardSubtitle,
  formatCivicAddress,
  registrationCheckUrl,
  resolveOfficialSource,
  shortAddress,
} from "./voting";

/** ISO date `days` from now — every case here is relative to "today". */
function offsetDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function location(overrides: Partial<PollingLocation> = {}): PollingLocation {
  return {
    address: {
      line1: "828 I Street",
      city: "Sacramento",
      state: "CA",
      zip: "95814",
    },
    ...overrides,
  };
}

function response(
  overrides: Partial<VoterInfoResponse> = {},
): VoterInfoResponse {
  return {
    kind: "civicinfo#voterInfoResponse",
    election: {
      id: "1",
      name: "California Statewide General Election",
      electionDay: offsetDays(12),
      ocdDivisionId: "ocd-division/country:us/state:ca",
    },
    normalizedInput: {
      line1: "1414 K Street",
      city: "Sacramento",
      state: "CA",
      zip: "95814",
    },
    ...overrides,
  };
}

/** Fetch a method by id, failing the test rather than yielding `undefined`. */
function method(plan: VotingPlan, id: VotingMethodId): VotingMethod {
  const found = plan.methods.find((m) => m.id === id);
  assert.ok(found, `expected a "${id}" method in the plan`);
  return found;
}

void test("electionPhase reports the phase relative to today", () => {
  assert.equal(electionPhase(offsetDays(12)), "upcoming");
  assert.equal(electionPhase(offsetDays(0)), "electionDay");
  assert.equal(electionPhase(offsetDays(-3)), "ended");
  assert.equal(electionPhase(undefined), "upcoming");
});

void test("formatCivicAddress joins a Civic address onto one line", () => {
  assert.equal(
    formatCivicAddress({
      line1: "828 I Street",
      city: "Sacramento",
      state: "CA",
      zip: "95814",
    }),
    "828 I Street, Sacramento, CA 95814",
  );
});

void test("shortAddress truncates the stored address to street and city", () => {
  assert.equal(
    shortAddress("1414 K Street, Sacramento, CA 95814, USA"),
    "1414 K Street, Sacramento",
  );
  assert.equal(shortAddress("Sacramento, CA"), "Sacramento, CA");
});

void test("buildVotingPlan returns a full method list with no data at all", () => {
  const plan = buildVotingPlan(undefined);
  assert.deepEqual(
    plan.methods.map((m) => m.id),
    ["mail", "dropBox", "earlyInPerson", "electionDay"],
  );
  assert.equal(plan.noLocationsPublished, true);
});

void test("missing location details do not imply a method is unavailable", () => {
  // The distinction is the whole point of the screen: "we don't know yet" must
  // not render as "this method isn't offered".
  const dropBox = method(buildVotingPlan(response()), "dropBox");
  assert.equal(dropBox.status, "unknown");
  assert.equal(dropBox.chip.label, "Details unavailable");
  assert.equal(dropBox.subtitle, "Location details unavailable");
});

void test("listed locations do not establish current availability", () => {
  const plan = buildVotingPlan(
    response({ dropOffLocations: [location(), location()] }),
  );
  const dropBox = method(plan, "dropBox");
  assert.equal(dropBox.status, "listed");
  assert.equal(dropBox.chip.label, "Locations listed");
  assert.equal(dropBox.subtitle, "2 locations");
  assert.equal(plan.noLocationsPublished, false);
});

void test("location counts use singular phrasing for one location", () => {
  const plan = buildVotingPlan(response({ pollingLocations: [location()] }));
  assert.equal(method(plan, "electionDay").subtitle, "1 polling place");
});

void test("early voting is upcoming until its published window opens", () => {
  const plan = buildVotingPlan(
    response({ earlyVoteSites: [location({ startDate: offsetDays(2) })] }),
  );
  const early = method(plan, "earlyInPerson");
  assert.equal(early.status, "upcoming");
  assert.equal(early.chip.label, "Opens in 2 days");
});

void test("a method closes once its published window has passed", () => {
  const plan = buildVotingPlan(
    response({
      earlyVoteSites: [
        location({ startDate: offsetDays(-9), endDate: offsetDays(-2) }),
      ],
    }),
  );
  assert.equal(method(plan, "earlyInPerson").status, "closed");
});

void test("a mail-only election drops early voting and limits in-person", () => {
  const plan = buildVotingPlan(response({ mailOnly: true }));
  assert.equal(plan.mailOnly, true);
  assert.equal(
    plan.methods.some((m) => m.id === "earlyInPerson"),
    false,
  );
  // In-person is reduced, not removed — mailOnly does not mean "you cannot vote
  // in person", and hiding the row would say exactly that.
  assert.equal(method(plan, "electionDay").status, "limited");
  assert.equal(method(plan, "mail").status, "unknown");
});

void test("no step or subtitle ever states a deadline we cannot source", () => {
  const plan = buildVotingPlan(response());
  assert.equal(method(plan, "mail").subtitle, "Return deadline not available");
  for (const m of plan.methods) {
    for (const step of m.steps) {
      assert.doesNotMatch(
        `${step.title} ${step.detail ?? ""}`,
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/,
        `step "${step.title}" must not name a date`,
      );
    }
  }
});

void test("listed locations do not count as verified availability", () => {
  const plan = buildVotingPlan(
    response({
      dropOffLocations: [location()],
      pollingLocations: [location()],
      earlyVoteSites: [location({ startDate: offsetDays(3) })],
    }),
  );
  assert.equal(plan.availableCount, 0);
});

void test("resolveOfficialSource prefers the local jurisdiction", () => {
  const source = resolveOfficialSource(
    response({
      state: [
        {
          name: "California",
          electionAdministrationBody: {
            name: "California Secretary of State",
            electionInfoUrl: "https://sos.ca.gov",
          },
          localJurisdiction: {
            name: "Sacramento County",
            electionAdministrationBody: {
              name: "Sacramento County Voter Registration & Elections",
              electionInfoUrl: "https://elections.saccounty.gov",
              electionOfficials: [{ officePhoneNumber: "(916) 875-6451" }],
            },
          },
        },
      ],
    }),
  );
  assert.ok(source);
  assert.equal(source.name, "Sacramento County Voter Registration & Elections");
  assert.equal(source.electionInfoUrl, "https://elections.saccounty.gov");
  assert.equal(source.phone, "(916) 875-6451");
});

void test("resolveOfficialSource falls back to the state body", () => {
  const source = resolveOfficialSource(
    response({
      state: [
        {
          name: "California",
          electionAdministrationBody: { name: "California Secretary of State" },
        },
      ],
    }),
  );
  assert.ok(source);
  assert.equal(source.name, "California Secretary of State");
});

void test("provider lookup destinations are not attributed to an official authority", () => {
  const suppliedLocation = location();
  const data = withSource({
    provider: {
      name: "democracy_works",
      fetchedAt: "2099-10-01T12:00:00Z",
      coverage: "partial",
      addressScope: "address",
      ballotDataStatus: "provided",
      addressNormalization: "unavailable",
      logistics: "lookup_links_only",
    },
    pollingLocations: [suppliedLocation],
  });
  const plan = buildVotingPlan(data);
  assert.equal(resolveOfficialSource(data), undefined);
  assert.equal(plan.source, undefined);
  assert.equal(registrationCheckUrl(plan.source), "https://vote.gov");
  for (const votingMethod of plan.methods) {
    assert.equal(votingMethod.instructionsUrl, undefined);
    assert.deepEqual(votingMethod.steps, []);
  }
  assert.deepEqual(method(plan, "electionDay").locations, [suppliedLocation]);
  assert.equal(method(plan, "electionDay").chip.label, "Locations listed");
});

void test("resolveOfficialSource yields nothing without administration data", () => {
  assert.equal(resolveOfficialSource(response()), undefined);
  assert.equal(resolveOfficialSource(undefined), undefined);
});

void test("entryCardSubtitle asks for an address before anything else", () => {
  assert.equal(
    entryCardSubtitle(false, undefined, "upcoming"),
    "Add your address to see your options",
  );
});

void test("entryCardSubtitle does not promise availability from location counts", () => {
  const many = buildVotingPlan(
    response({
      dropOffLocations: [location()],
      pollingLocations: [location()],
    }),
  );
  assert.equal(
    entryCardSubtitle(true, many, "upcoming"),
    "Ways to vote and where to go",
  );

  const one = buildVotingPlan(response({ dropOffLocations: [location()] }));
  assert.equal(
    entryCardSubtitle(true, one, "upcoming"),
    "Ways to vote and where to go",
  );
});

void test("entryCardSubtitle reframes on Election Day and after", () => {
  const plan = buildVotingPlan(response({ pollingLocations: [location()] }));
  assert.equal(
    entryCardSubtitle(true, plan, "electionDay"),
    "Polling places, hours, and directions",
  );
  assert.equal(
    entryCardSubtitle(true, plan, "ended"),
    "See results and what comes next",
  );
});

void test("entryCardSubtitle never promises a deadline it doesn't have", () => {
  assert.doesNotMatch(
    entryCardSubtitle(true, buildVotingPlan(response()), "upcoming"),
    /postmark|deadline by|due/i,
  );
});

// --- instruction provenance -----------------------------

/** A response carrying an administration body, i.e. a citable source. */
function withSource(
  overrides: Partial<VoterInfoResponse> = {},
): VoterInfoResponse {
  return response({
    state: [
      {
        name: "California",
        localJurisdiction: {
          name: "Sacramento County",
          electionAdministrationBody: {
            name: "Sacramento County Voter Registration & Elections",
            electionInfoUrl: "https://elections.saccounty.gov",
            absenteeVotingInfoUrl: "https://elections.saccounty.gov/vbm",
            votingLocationFinderUrl: "https://elections.saccounty.gov/centers",
          },
        },
      },
    ],
    ...overrides,
  });
}

void test("steps are withheld entirely when no source can be cited", () => {
  // The steps summarize an authority's instructions. With nothing to point at,
  // showing them would make Billion the author of voting procedure.
  const plan = buildVotingPlan(response());
  for (const m of plan.methods) {
    assert.equal(m.steps.length, 0, `${m.id} must not carry unsourced steps`);
    assert.equal(m.instructionsUrl, undefined);
  }
});

void test("official links remain available without inventing instruction text", () => {
  const plan = buildVotingPlan(withSource());
  const mail = method(plan, "mail");
  assert.equal(mail.steps.length, 0);
  assert.equal(mail.instructionsUrl, "https://elections.saccounty.gov/vbm");

  const day = method(plan, "electionDay");
  assert.equal(day.steps.length, 0);
  assert.equal(day.instructionsUrl, "https://elections.saccounty.gov/centers");
});

void test("authority URLs never authorize hardcoded instructions for any method", () => {
  for (const mailOnly of [false, true]) {
    for (const m of buildVotingPlan(withSource({ mailOnly })).methods) {
      assert.deepEqual(m.steps, [], `${m.id} has no supplied instruction text`);
      assert.ok(m.instructionsUrl);
    }
  }
});

void test("a published date window and hours do not prove a location is open now", () => {
  const plan = buildVotingPlan(
    response({
      dropOffLocations: [
        location({
          startDate: offsetDays(-2),
          endDate: offsetDays(2),
          pollingHours: "9am–5pm",
        }),
      ],
    }),
  );
  assert.equal(method(plan, "dropBox").status, "listed");
  assert.equal(method(plan, "dropBox").chip.label, "Locations listed");
});

// --- registration check always resolves ------------------------------------

void test("registrationCheckUrl prefers the most specific official tool", () => {
  assert.equal(
    registrationCheckUrl({
      name: "x",
      registrationConfirmationUrl: "https://voterstatus.sos.ca.gov",
      registrationUrl: "https://registertovote.ca.gov",
    }),
    "https://voterstatus.sos.ca.gov",
  );
  assert.equal(
    registrationCheckUrl({
      name: "x",
      registrationUrl: "https://registertovote.ca.gov",
    }),
    "https://registertovote.ca.gov",
  );
});

void test("registrationCheckUrl never leaves the reader without an exit", () => {
  // The old build rendered "we can't confirm you're registered" with no action
  // whenever Civic omitted both URLs. There must always be somewhere to go.
  assert.equal(registrationCheckUrl(undefined), "https://vote.gov");
  assert.equal(registrationCheckUrl({ name: "x" }), "https://vote.gov");
});
