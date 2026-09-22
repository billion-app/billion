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
  return d.toISOString().slice(0, 10);
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

void test("missing locations read as unpublished, never as unavailable", () => {
  // The distinction is the whole point of the screen: "we don't know yet" must
  // not render as "this method isn't offered".
  const dropBox = method(buildVotingPlan(response()), "dropBox");
  assert.equal(dropBox.status, "unknown");
  assert.equal(dropBox.chip.label, "Not published");
  assert.equal(dropBox.subtitle, "Locations not published yet");
});

void test("a method becomes available once locations are published", () => {
  const plan = buildVotingPlan(
    response({ dropOffLocations: [location(), location()] }),
  );
  const dropBox = method(plan, "dropBox");
  assert.equal(dropBox.status, "available");
  assert.equal(dropBox.chip.label, "Open now");
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
  assert.equal(method(plan, "mail").status, "available");
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

void test("California postage guidance is gated on the resolved state", () => {
  // Steps only exist alongside a citable source, so both halves need one.
  const caMail = method(buildVotingPlan(withSource()), "mail");
  assert.match(caMail.steps.at(-1)?.title ?? "", /no stamp needed/);

  const nvPlan = buildVotingPlan(
    withSource({
      normalizedInput: {
        line1: "1 Main St",
        city: "Reno",
        state: "NV",
        zip: "89501",
      },
    }),
  );
  assert.doesNotMatch(
    method(nvPlan, "mail").steps.at(-1)?.title ?? "",
    /no stamp needed/,
  );
});

void test("availableCount counts only methods usable today", () => {
  const plan = buildVotingPlan(
    response({
      dropOffLocations: [location()],
      pollingLocations: [location()],
      earlyVoteSites: [location({ startDate: offsetDays(3) })],
    }),
  );
  assert.equal(plan.availableCount, 2);
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

void test("entryCardSubtitle counts available ways to vote", () => {
  const many = buildVotingPlan(
    response({
      dropOffLocations: [location()],
      pollingLocations: [location()],
    }),
  );
  assert.equal(
    entryCardSubtitle(true, many, "upcoming"),
    "2 ways to vote in this election",
  );

  const one = buildVotingPlan(response({ dropOffLocations: [location()] }));
  assert.equal(
    entryCardSubtitle(true, one, "upcoming"),
    "1 way to vote in this election",
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

// --- source gating: no source, no step summary -----------------------------

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

void test("steps appear once an official instructions URL exists", () => {
  const plan = buildVotingPlan(withSource());
  const mail = method(plan, "mail");
  assert.ok(mail.steps.length > 0);
  assert.equal(mail.instructionsUrl, "https://elections.saccounty.gov/vbm");

  const day = method(plan, "electionDay");
  assert.ok(day.steps.length > 0);
  assert.equal(day.instructionsUrl, "https://elections.saccounty.gov/centers");
});

void test("every method with steps can name the page it summarizes", () => {
  const plan = buildVotingPlan(withSource());
  for (const m of plan.methods) {
    if (m.steps.length > 0) {
      assert.ok(m.instructionsUrl, `${m.id} has steps but no source URL`);
    }
  }
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
