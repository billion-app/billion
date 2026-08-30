import assert from "node:assert/strict";
import test from "node:test";

import { campaignFor, sanitizeCampaignCode } from "./campaigns";
import { isTrackedDestination, TRACKED_DESTINATIONS } from "./destinations";

void test("the D10 campaign keeps its event-specific QR attribution", () => {
  assert.deepEqual(campaignFor("d10_leadership_2026_09_05"), {
    utm_source: "d10_leadership_coalition",
    utm_medium: "qr",
    utm_campaign: "d10_leadership_2026_09_05",
  });
});

void test("campaign codes accept printable URL-safe names only", () => {
  assert.equal(sanitizeCampaignCode(" d10_meeting "), "d10_meeting");
  assert.equal(sanitizeCampaignCode("spaces are not allowed"), "");
  assert.equal(sanitizeCampaignCode("x".repeat(33)), "");
});

void test("the email QR destination points to the dedicated signup page", () => {
  assert.equal(TRACKED_DESTINATIONS.subscribe.target, "/subscribe");
  assert.equal(TRACKED_DESTINATIONS.home.target, "/#waitlist");
  assert.equal(isTrackedDestination("subscribe"), true);
  assert.equal(isTrackedDestination("https://example.com"), false);
});
