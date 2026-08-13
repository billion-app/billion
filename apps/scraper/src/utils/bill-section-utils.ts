/**
 * This file contains utilities for working with bill sections
 * to ensure they meet the requirements for the bill sectioning system.
 */

/**
 * Validates that a bill section has all required properties
 * @param section - The section to validate
 * @returns true if valid, false otherwise
 */
export function isValidBillSection(section: any): boolean {
  return (
    section &&
    typeof section.structuralPath === 'string' &&
    typeof section.displayNumber === 'string' &&
    typeof section.heading === 'string' &&
    typeof section.order === 'number' &&
    typeof section.text === 'string' &&
    section.structuralPath.length > 0 &&
    section.displayNumber.length > 0 &&
    section.heading.length >= 0 && // Can be empty
    section.text.length >= 0 // Can be empty
  );
}

/**
 * Gets the hierarchical path of a section
 * @param section - The section to get path for
 * @returns The path as a string
 */
export function getSectionPath(section: any): string {
  return section.structuralPath || '';
}

/**
 * Gets the display number of a section
 * @param section - The section to get display number for
 * @returns The display number as a string
 */
export function getSectionDisplayNumber(section: any): string {
  return section.displayNumber || '';
}

/**
 * Gets the heading of a section
 * @param section - The section to get heading for
 * @returns The heading as a string
 */
export function getSectionHeading(section: any): string {
  return section.heading || '';
}

/**
 * Gets the order of a section
 * @param section - The section to get order for
 * @returns The order as a number
 */
export function getSectionOrder(section: any): number {
  return section.order || 0;
}

/**
 * Gets the text of a section
 * @param section - The section to get text for
 * @returns The text as a string
 */
export function getSectionText(section: any): string {
  return section.text || '';
}