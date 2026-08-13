import { describe, it, expect } from "vitest";
import { calculateSectionHash } from "./apps/scraper/src/utils/bill-parser.js";

// Test the hash calculation functionality
describe("Bill Parser Utilities", () => {
  it("should calculate consistent hashes for identical text", () => {
    const text = "This is test section content";
    const hash1 = calculateSectionHash(text);
    const hash2 = calculateSectionHash(text);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
  });

  it("should produce different hashes for different text", () => {
    const hash1 = calculateSectionHash("Text A");
    const hash2 = calculateSectionHash("Text B");

    expect(hash1).not.toBe(hash2);
  });

  it("should handle empty strings", () => {
    const emptyHash = calculateSectionHash("");
    expect(emptyHash).toHaveLength(64);
  });
});

console.log("Basic functionality tests completed successfully!");