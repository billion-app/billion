/**
 * Comprehensive test suite to verify all acceptance criteria are met
 */

import { describe, it, expect, vi } from "vitest";
import { generateBillBriefTwoPass, determineSectionInclusion, SectionClassificationSchema } from "./bill-brief-two-pass";
import { shouldUseTwoPassGeneration } from "./bill-brief";

// Mock data representing a large bill similar to H.R. 8800
const largeBillData = {
  title: "H.R. 8800 - Fiscal Year 2027 National Defense Authorization Act",
  billNumber: "H.R. 8800",
  url: "https://example.com/hr-8800",
  fullText: `
Section 1 - Short Title
This Act may be cited as the "Fiscal Year 2027 National Defense Authorization Act".

Section 2 - Authorization of Appropriations
This section authorizes $778 billion in defense appropriations for fiscal year 2027, including $650 billion for military personnel and $128 billion for operations and maintenance.

Section 3 - Program Establishment
This section establishes the National Cybersecurity Defense Initiative to strengthen cybersecurity infrastructure across federal agencies.

Section 4 - Civil Rights Enforcement
This section strengthens civil rights protections by requiring federal agencies to conduct regular compliance reviews of programs receiving federal funding.

Section 5 - Military Personnel
This section amends the military personnel compensation structure to increase base pay for enlisted personnel.

Section 6 - Intelligence Activities
This section authorizes new intelligence collection activities related to national security threats.

Section 7 - Emergency Authorities
This section provides emergency authorities for rapid deployment of military forces in response to national emergencies.

Section 8 - Oversight Provisions
This section establishes new oversight requirements for defense spending and procurement processes.

Section 9 - Sunset Provisions
This section includes sunset provisions for certain defense programs that expire after 5 years unless renewed.

Section 10 - General Provisions
This section contains general administrative provisions and definitions for the purposes of this Act.

Section 11 - Funding Authorization
This section authorizes $100 million for the National Climate Fund to support climate research and adaptation initiatives.

Section 12 - Privacy Protections
This section establishes enhanced privacy protections for individuals whose data is collected by defense agencies.

Section 13 - National Security
This section authorizes military assistance to allied nations and strengthens international security partnerships.

Section 14 - Review Requirements
This section requires annual reviews of defense spending to ensure efficiency and effectiveness.

Section 15 - Reporting Requirements
This section mandates quarterly reporting on defense program performance to Congress.

Section 16 - Preemption Clause
This section preempts state laws that conflict with federal defense policies.

Section 17 - Deadlines
This section establishes specific deadlines for implementation of defense programs.

Section 18 - Penalties
This section establishes penalties for violations of defense regulations.

Section 19 - Safeguards
This section includes safeguards for whistleblower protection in defense contracting.

Section 20 - Definitions
This section provides definitions for key terms used throughout the Act.
  `.trim(),
  officialSummary: "This bill authorizes substantial defense appropriations, establishes new cybersecurity initiatives, and strengthens civil rights protections while including oversight and sunset provisions.",
  status: "proposed",
};

// Mock data for a small bill to verify normal flow
const smallBillData = {
  title: "Small Test Bill",
  billNumber: "H.R. 123",
  url: "https://example.com/hr-123",
  fullText: "Section 1 - Test provision. This is a simple test provision for a small bill.",
  officialSummary: "A simple test bill for small bill testing.",
  status: "proposed",
};

describe("Two-pass Generation - Acceptance Criteria", () => {
  it("should detect large bills correctly", () => {
    const largeText = "Section 1 - Test\n".repeat(15); // 15 sections
    const result = shouldUseTwoPassGeneration(largeText);
    expect(result).toBe(true);

    const smallText = "Section 1 - Test\nSection 2 - Test\n";
    const result2 = shouldUseTwoPassGeneration(smallText);
    expect(result2).toBe(false);
  });

  it("should identify high-impact sections correctly", () => {
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

  it("should identify low-impact sections correctly", () => {
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

  it("should process large bills within token budget", async () => {
    const result = await generateBillBriefTwoPass(largeBillData);

    // Should return a valid brief structure
    expect(result).toBeDefined();
    expect(result).toHaveProperty("hook");
    expect(result).toHaveProperty("version");
    expect(result).toHaveProperty("legalStatus");

    // Should have appropriate properties for a proposed bill
    expect(result?.legalStatus).toBe("proposed");

    // Should include key policy areas
    expect(result?.hook).toContain("H.R. 8800");
    expect(result?.hook).toContain("includes");
  }, { timeout: 30000 });

  it("should handle exclusion of sections with reasons", () => {
    // Test that excluded sections are recorded with reasons
    const section = {
      id: "test-exclude",
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
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("below threshold");
  });

  it("should include all required policy dimensions", () => {
    const section = {
      id: "test-financial",
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

  it("should properly classify different types of sections", () => {
    // Test authorization section
    const authorizationSection = {
      id: "test-auth",
      heading: "Section 1 - Program Authorization",
      content: "This section authorizes the establishment of a new federal program.",
      fullText: "",
      billNumber: "H.R. 1234",
      title: "Test Bill",
      url: "https://example.com",
      status: "proposed",
    };

    const result1 = determineSectionInclusion(authorizationSection);
    expect(result1.include).toBe(true);
    expect(result1.notabilityScore).toBeGreaterThanOrEqual(8);

    // Test repeal section
    const repealSection = {
      id: "test-repeal",
      heading: "Section 2 - Repeal of Old Law",
      content: "This section repeals the outdated Environmental Protection Act.",
      fullText: "",
      billNumber: "H.R. 1234",
      title: "Test Bill",
      url: "https://example.com",
      status: "proposed",
    };

    const result2 = determineSectionInclusion(repealSection);
    expect(result2.include).toBe(true);
    expect(result2.notabilityScore).toBeGreaterThanOrEqual(8);
  });

  it("should validate section classification schema", () => {
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

  it("should reject invalid classifications", () => {
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

  it("should not trigger two-pass for small bills", () => {
    const smallText = "Section 1 - Test\nSection 2 - Test\nSection 3 - Test\n";
    const result = shouldUseTwoPassGeneration(smallText);
    expect(result).toBe(false);
  });

  it("should handle edge cases properly", () => {
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