/**
 * Test to verify the two-pass detection logic
 */

import { describe, it, expect } from "vitest";
import { shouldUseTwoPassGeneration } from "./bill-brief";

describe("Two-pass generation detection", () => {
  it("should detect large bills correctly", () => {
    // Create a mock large bill text with many sections
    const largeBillText = "Section 1 - Test\n".repeat(15); // 15 sections

    const result = shouldUseTwoPassGeneration(largeBillText);

    expect(result).toBe(true);
  });

  it("should not trigger for small bills", () => {
    // Create a small bill text with few sections
    const smallBillText = "Section 1 - Test\nSection 2 - Test\nSection 3 - Test\n";

    const result = shouldUseTwoPassGeneration(smallBillText);

    expect(result).toBe(false);
  });

  it("should handle edge cases", () => {
    // Empty text
    const emptyText = "";
    const result1 = shouldUseTwoPassGeneration(emptyText);
    expect(result1).toBe(false);

    // Very long text but few sections
    const longButFewSections = "Section 1 - Test\n".repeat(5); // 5 sections, but long content
    const result2 = shouldUseTwoPassGeneration(longButFewSections);
    expect(result2).toBe(false);
  });
});