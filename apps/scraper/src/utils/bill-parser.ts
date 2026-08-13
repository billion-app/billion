import { BillSourceVersion, BillSection } from "@acme/db/schema";
import { db } from "@acme/db/client";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { parseStringPromise } from "xml2js";

/**
 * Parses a bill's XML into structured sections
 *
 * @param xmlContent - The complete XML content from congress.gov
 * @param billId - The database ID of the bill
 * @param versionCode - The version code (e.g., "hr", "s")
 * @param sourceUrl - The source URL
 * @param officialDate - The official date of the bill version
 * @returns The parsed sections and source version info
 */
export async function parseBillSections(
  xmlContent: string,
  billId: string,
  versionCode: string,
  sourceUrl: string,
  officialDate?: Date,
): Promise<{
  sourceVersionId: string;
  sections: {
    structuralPath: string;
    displayNumber: string;
    heading: string;
    order: number;
    text: string;
    sourceOffsets?: { start: number; end: number }[];
    xmlIds?: string[];
  }[];
}> {
  // Create source version record
  const sourceHash = createHash("sha256").update(xmlContent).digest("hex");

  const [sourceVersion] = await db
    .insert(BillSourceVersion)
    .values({
      billId,
      versionCode,
      officialDate,
      sourceUrl,
      rawXml: xmlContent,
      sourceHash,
      parseStatus: "pending",
    })
    .returning({ id: BillSourceVersion.id });

  // Parse the XML using xml2js
  const parsedXml = await parseStringPromise(xmlContent, {
    explicitArray: false,
    ignoreAttrs: false,
    explicitRoot: false,
  });

  // Process the bill structure
  const sections = await processBillStructure(parsedXml, sourceVersion.id, 0);

  // Update the parse status to success
  await db
    .update(BillSourceVersion)
    .set({ parseStatus: "success" })
    .where(eq(BillSourceVersion.id, sourceVersion.id));

  return {
    sourceVersionId: sourceVersion.id,
    sections,
  };
}

/**
 * Recursively processes bill structure to create sections
 *
 * @param element - The current XML element to process
 * @param sourceVersionId - The source version ID
 * @param depth - Current nesting depth for structural path generation
 * @returns Array of section objects
 */
async function processBillStructure(
  element: any,
  sourceVersionId: string,
  depth: number,
  parentPath: string = "",
): Promise<{
  structuralPath: string;
  displayNumber: string;
  heading: string;
  order: number;
  text: string;
  sourceOffsets?: { start: number; end: number }[];
  xmlIds?: string[];
}[]> {
  const sections: any[] = [];

  // Handle the case where we have a single element
  if (element && typeof element === 'object') {
    // Process titles
    if (element.title) {
      const titleElements = Array.isArray(element.title) ? element.title : [element.title];

      for (let i = 0; i < titleElements.length; i++) {
        const title = titleElements[i];
        const titlePath = `${parentPath}${parentPath ? '/' : ''}title-${i + 1}`;

        // Extract title text
        let titleText = '';
        if (typeof title === 'string') {
          titleText = title;
        } else if (title._) {
          titleText = title._;
        } else if (title.$ && title.$.value) {
          titleText = title.$.value;
        }

        // Add the title section
        sections.push({
          structuralPath: titlePath,
          displayNumber: `Title ${i + 1}`,
          heading: titleText,
          order: i,
          text: titleText,
        });

        // Process subtitles if they exist
        if (title.subtitle) {
          const subtitleElements = Array.isArray(title.subtitle) ? title.subtitle : [title.subtitle];

          for (let j = 0; j < subtitleElements.length; j++) {
            const subtitle = subtitleElements[j];
            const subtitlePath = `${titlePath}/subtitle-${j + 1}`;

            // Extract subtitle text
            let subtitleText = '';
            if (typeof subtitle === 'string') {
              subtitleText = subtitle;
            } else if (subtitle._) {
              subtitleText = subtitle._;
            } else if (subtitle.$ && subtitle.$.value) {
              subtitleText = subtitle.$.value;
            }

            // Add the subtitle section
            sections.push({
              structuralPath: subtitlePath,
              displayNumber: `Subtitle ${j + 1}`,
              heading: subtitleText,
              order: j,
              text: subtitleText,
            });

            // Process sections within the subtitle
            if (subtitle.section) {
              const sectionElements = Array.isArray(subtitle.section) ? subtitle.section : [subtitle.section];

              for (let k = 0; k < sectionElements.length; k++) {
                const section = sectionElements[k];
                const sectionPath = `${subtitlePath}/section-${k + 1}`;

                // Extract section text
                let sectionText = '';
                if (typeof section === 'string') {
                  sectionText = section;
                } else if (section._) {
                  sectionText = section._;
                } else if (section.$ && section.$.value) {
                  sectionText = section.$.value;
                }

                // Add the section
                sections.push({
                  structuralPath: sectionPath,
                  displayNumber: `Section ${k + 1}`,
                  heading: sectionText,
                  order: k,
                  text: sectionText,
                });
              }
            }
          }
        }
      }
    }

    // Handle sections directly at the root level
    if (element.section) {
      const sectionElements = Array.isArray(element.section) ? element.section : [element.section];

      for (let i = 0; i < sectionElements.length; i++) {
        const section = sectionElements[i];
        const sectionPath = `${parentPath}${parentPath ? '/' : ''}section-${i + 1}`;

        // Extract section text
        let sectionText = '';
        if (typeof section === 'string') {
          sectionText = section;
        } else if (section._) {
          sectionText = section._;
        } else if (section.$ && section.$.value) {
          sectionText = section.$.value;
        }

        // Add the section
        sections.push({
          structuralPath: sectionPath,
          displayNumber: `Section ${i + 1}`,
          heading: sectionText,
          order: i,
          text: sectionText,
        });
      }
    }

    // Handle subsections if present
    if (element.subsection) {
      const subsectionElements = Array.isArray(element.subsection) ? element.subsection : [element.subsection];

      for (let i = 0; i < subsectionElements.length; i++) {
        const subsection = subsectionElements[i];
        const subsectionPath = `${parentPath}${parentPath ? '/' : ''}subsection-${i + 1}`;

        // Extract subsection text
        let subsectionText = '';
        if (typeof subsection === 'string') {
          subsectionText = subsection;
        } else if (subsection._) {
          subsectionText = subsection._;
        } else if (subsection.$ && subsection.$.value) {
          subsectionText = subsection.$.value;
        }

        // Add the subsection
        sections.push({
          structuralPath: subsectionPath,
          displayNumber: `Subsection ${i + 1}`,
          heading: subsectionText,
          order: i,
          text: subsectionText,
        });
      }
    }
  }

  return sections;
}

/**
 * Calculates the hash of a section text for deduplication
 *
 * @param text - The section text
 * @returns SHA-256 hash of the text
 */
export function calculateSectionHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}