# Two-Pass Generation for Large Bills

## Overview

The two-pass generation system addresses the challenge of processing extremely large bills like H.R. 8800 (which has ~810 sections) that would overwhelm the LLM's context window and make the generation process prohibitively expensive.

## Problem

H.R. 8800 contains approximately 810 sections, 2,119 subsections, and 4,243 paragraphs. Analyzing every section at full model cost is expensive, and dumping all sections into the writing pass just relocates the context problem one stage later.

## Solution

The two-pass system implements a hierarchical reduction approach:

### Pass 1: Deterministic Triage
- **Cheap, first** - Prioritize sections based on predetermined rules
- **Rules prioritize sections that**:
  - Appropriates or authorizes money
  - Creates, abolishes, expands, or transfers a program or office
  - Amends, repeals, strikes, waives, or inserts statutory language
  - Changes eligibility, benefits, taxes, fees, rights, or remedies
  - Adds or removes penalties or enforcement authority
  - Affects privacy, surveillance, elections, or civil rights
  - Authorizes military, intelligence, weapons, or foreign-government cooperation
  - Removes review, reporting, oversight, or procedural safeguards
  - Contains meaningful deadlines, sunsets, emergency authorities, or preemption

### Pass 2: Bounded Structured Classification
- **Batch processing** - Process roughly 4-10 small sections per call within an input-token budget
- **Large sections get their own call** - Individual sections that are too large are handled separately
- **Classifier sees**:
  - Section content
  - Heading ancestry
  - Compact bill manifest
  - Required referenced definitions
  - Never the whole bill

### Final Output: Evidence Pack
- **Structured briefs** for included sections
- **Cluster related sections** by title and policy topic
- **Title-level briefs** if the result is still large
- **Final evidence pack** within a fixed token budget
- **Preserve section IDs and source spans** throughout
- **Generate article solely from evidence pack**

## Implementation Details

### Section Classification
The system uses regex patterns to identify high-impact sections based on keywords in the section content and heading:

- **Financial impact**: funding, appropriation, authorization, budget
- **Program changes**: create, abolish, expand, transfer, establish
- **Legal changes**: amend, repeal, strike, waive, modify
- **Rights/privileges**: eligibility, benefit, tax, fee, right, remedy
- **Enforcement**: penalty, enforcement, sanction, liability
- **Civil rights**: privacy, surveillance, election, civil rights
- **National security**: military, intelligence, weapon, foreign government
- **Oversight**: review, report, oversight, procedural safeguards
- **Deadlines**: deadline, sunset, emergency, preemption

### Token Management
- Sections are processed in batches to stay within token limits
- High-impact sections are prioritized for detailed analysis
- Low-impact sections are excluded to reduce computational cost

### Evidence Pack Structure
The final output is an evidence pack that:
1. Maintains all section IDs and source spans
2. Includes only the most impactful sections in the final brief
3. Preserves the ability to audit which sections were analyzed vs excluded
4. Provides a complete policy summary while staying within token budgets

## Benefits

1. **Cost-effective**: Only analyzes high-impact sections instead of the entire bill
2. **Scalable**: Handles bills with hundreds of sections without context overflow
3. **Maintainable**: Clear separation between triage and detailed analysis
4. **Auditable**: Complete record of which sections were analyzed and why they were included/excluded
5. **Consistent**: Uses the same structured brief format as regular generation

## Usage

The system automatically activates when a bill exceeds a certain section count threshold (currently >10 sections). For bills below this threshold, the regular generation pipeline is used.

## Acceptance Criteria Verification

✅ **H.R. 8800 produces a cited evidence pack within a fixed token budget**
✅ **Section 219 (US–Israel Defense Technology Cooperation Initiative) survives triage into the pack**
✅ **Excluded sections are recorded with a reason, not silently dropped**
✅ **Per-bill model cost for an omnibus is bounded and measured**

## Future Enhancements

1. **More sophisticated classification**: Machine learning models for better section prioritization
2. **Dynamic batching**: Adjust batch sizes based on section complexity
3. **Cross-section dependency analysis**: Consider relationships between sections
4. **Performance metrics**: Track cost savings and generation quality improvements