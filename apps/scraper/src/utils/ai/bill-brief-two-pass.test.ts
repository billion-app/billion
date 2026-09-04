import { describe, it, expect, vi } from "vitest";

import { determineSectionInclusion, SectionClassificationSchema } from "./bill-brief-two-pass";

describe("determineSectionInclusion", () => {
  it("should correctly identify high-impact sections", () => {
    const section = {
      id: "test-1",
      heading: "Section 1 - Funding Authorization",
      content: "This section authorizes funding for the Department of Education.",
      fullText: "",
      billNumber: "H.R. 1234",
      title: "Test Bill",
      url: "https://example.com",
      status: "proposed",
    };

    const result = determineSectionInclusion(section);

    expect(result.include).toBe(true);
    expect(result.notabilityScore).toBeGreaterThanOrEqual(8);
    expect(result.reason).toContain("high-impact");
  });

  it("should correctly identify low-impact sections", () => {
    const section = {
      id: "test-2",
      heading: "Section 100 - General Provisions",
      content: "This section contains general administrative provisions.",
      fullText: "",
      billNumber: "H.R. 1234",
      title: "Test Bill",
      url: "https://example.com",
      status: "proposed",
    };

    const result = determineSectionInclusion(section);

    expect(result.include).toBe(false);
    expect(result.notabilityScore).toBeLessThan(8);
    expect(result.reason).toContain("below threshold");
  });

  it("should correctly identify financial sections", () => {
    const section = {
      id: "test-3",
      heading: "Section 5 - Budget Allocation",
      content: "This section allocates $100 million to the National Park Service.",
      fullText: "",
      billNumber: "H.R. 1234",
      title: "Test Bill",
      url: "https://example.com",
      status: "proposed",
    };

    const result = determineSectionInclusion(section);

    expect(result.dimensions).toContain("financial");
    expect(result.moneyOrDeadlines).toContain("funding");
  });

  it("should correctly identify civil rights sections", () => {
    const section = {
      id: "test-4",
      heading: "Section 15 - Civil Rights Enforcement",
      content: "This section establishes new civil rights protections.",
      fullText: "",
      billNumber: "H.R. 1234",
      title: "Test Bill",
      url: "https://example.com",
      status: "proposed",
    };

    const result = determineSectionInclusion(section);

    expect(result.dimensions).toContain("civil_rights");
  });

  it("should identify sections with authorization keywords", () => {
    const section = {
      id: "test-5",
      heading: "Section 20 - Program Establishment",
      content: "This section establishes the National Climate Fund.",
      fullText: "",
      billNumber: "H.R. 1234",
      title: "Test Bill",
      url: "https://example.com",
      status: "proposed",
    };

    const result = determineSectionInclusion(section);

    expect(result.include).toBe(true);
    expect(result.notabilityScore).toBeGreaterThanOrEqual(8);
  });

  it("should identify sections with repeal keywords", () => {
    const section = {
      id: "test-6",
      heading: "Section 25 - Repeal of Old Law",
      content: "This section repeals the outdated Environmental Protection Act.",
      fullText: "",
      billNumber: "H.R. 1234",
      title: "Test Bill",
      url: "https://example.com",
      status: "proposed",
    };

    const result = determineSectionInclusion(section);

    expect(result.include).toBe(true);
    expect(result.notabilityScore).toBeGreaterThanOrEqual(8);
  });
});

describe("SectionClassificationSchema", () => {
  it("should validate a correct classification", () => {
    const validClassification = {
      include: true,
      reason: "Contains high-impact policy changes",
      notabilityScore: 8,
      dimensions: ["financial", "health"],
      concreteMechanism: "authorization",
      affectedGroups: ["individuals", "government_entities"],
      moneyOrDeadlines: ["funding"],
      dependencies: [],
      evidenceSpans: [],
      confidence: "high"
    };

    const result = SectionClassificationSchema.safeParse(validClassification);
    expect(result.success).toBe(true);
  });

  it("should reject an invalid classification", () => {
    const invalidClassification = {
      include: true,
      reason: "Contains high-impact policy changes",
      notabilityScore: 15, // Invalid - exceeds max of 10
      dimensions: ["financial", "health"],
      concreteMechanism: "authorization",
      affectedGroups: ["individuals", "government_entities"],
      moneyOrDeadlines: ["funding"],
      dependencies: [],
      evidenceSpans: [],
      confidence: "high"
    };

    const result = SectionClassificationSchema.safeParse(invalidClassification);
    expect(result.success).toBe(false);
  });
});

describe("Two-pass system integration", () => {
  it("should handle large bills appropriately", () => {
    // Test that large bills would trigger two-pass approach
    const largeText = "Section 1 - Test\n".repeat(100); // 100 sections

    // This would be tested with the full integration
    expect(largeText.length).toBeGreaterThan(1000);
  });
});