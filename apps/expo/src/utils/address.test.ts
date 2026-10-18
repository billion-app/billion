import assert from "node:assert/strict";
import test from "node:test";

import { formatCoordinates, formatPlacemark } from "./address";

test("prefers Android's composed address line", () => {
  // Android's system geocoder usually returns only this line and leaves the
  // discrete fields unset, so it must not be ignored in favour of them.
  assert.equal(
    formatPlacemark({
      formattedAddress: "123 Oak St, Sacramento, CA 95814",
      streetNumber: null,
      street: null,
      city: null,
      region: null,
      postalCode: null,
    }),
    "123 Oak St, Sacramento, CA 95814",
  );
});

test("builds from discrete fields when no composed line is available", () => {
  // iOS placemark shape: CLGeocoder fills the parts, no formattedAddress.
  assert.equal(
    formatPlacemark({
      streetNumber: "123",
      street: "Oak St",
      city: "Sacramento",
      region: "CA",
      postalCode: "95814",
    }),
    "123 Oak St, Sacramento, CA 95814",
  );
});

test("omits absent region and postal code without leaving separators", () => {
  assert.equal(
    formatPlacemark({
      streetNumber: "123",
      street: "Oak St",
      city: "Sacramento",
    }),
    "123 Oak St, Sacramento",
  );
});

test("falls back to district then subregion when city is missing", () => {
  assert.equal(
    formatPlacemark({ street: "Oak St", district: "Midtown" }),
    "Oak St, Midtown",
  );
  assert.equal(
    formatPlacemark({ street: "Oak St", subregion: "Sacramento County" }),
    "Oak St, Sacramento County",
  );
});

test("treats a blank composed line as absent", () => {
  assert.equal(
    formatPlacemark({
      formattedAddress: "   ",
      streetNumber: "123",
      street: "Oak St",
      city: "Sacramento",
    }),
    "123 Oak St, Sacramento",
  );
});

test("rejects a placemark without a street-level address", () => {
  // Just a city, or just coordinates — the caller sends the coordinate
  // instead of pretending it is a registered address.
  assert.equal(formatPlacemark({ city: "Sacramento", region: "CA" }), null);
  assert.equal(formatPlacemark({ street: "Oak St" }), null);
});

test("rejects missing, empty, and null placemarks", () => {
  assert.equal(formatPlacemark(null), null);
  assert.equal(formatPlacemark(undefined), null);
  assert.equal(formatPlacemark({}), null);
});

test("trims whitespace-only fields", () => {
  assert.equal(
    formatPlacemark({
      streetNumber: " 123 ",
      street: "Oak St",
      city: " Sacramento ",
    }),
    "123 Oak St, Sacramento",
  );
});

test("formats a coordinate pair to five decimals", () => {
  assert.equal(
    formatCoordinates(38.5766234, -121.4933712),
    "38.57662,-121.49337",
  );
});
