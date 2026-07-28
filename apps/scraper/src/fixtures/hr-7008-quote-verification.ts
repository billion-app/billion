/**
 * Regression excerpt from the engrossed House text of H.R. 7008 (119th
 * Congress), section 3. This provision appeared after the source window that
 * originally grounded brief generation, causing four valid citations to be
 * discarded as "unverified".
 *
 * Source: BILLS-119hr7008eh, published by the U.S. Government Publishing
 * Office. Whitespace is normalized the same way `bill_section.text` is stored.
 */
export const HR_7008_LATE_SECTION = [
  "SEC. 3. REQUIRING VOTERS TO PROVIDE PHOTO IDENTIFICATION.",
  "Notwithstanding any other provision of law and except as provided in subparagraph (B), the appropriate State or local election official may not provide a ballot for an election for Federal office to an individual who desires to vote in person unless the individual presents to the official a valid physical photo identification.",
  "If an individual does not present the identification required under subparagraph (A), the individual shall be permitted to cast a provisional ballot with respect to the election under section 302(a), except that the appropriate State or local election official may not make a determination under section 302(a)(4) that the individual is eligible under State law to vote in the election unless, not later than 3 days after casting the provisional ballot, the individual presents to the official the identification required under subparagraph (A).",
  "The appropriate State or local election official may not accept any ballot for an election for Federal office provided by an individual who votes other than in person unless the individual submits with the ballot a copy of a valid photo identification.",
  "This section and the amendments made by this section shall take effect on the date that is 90 days after the date of the enactment of this Act.",
].join(" ");

export const HR_7008_PREVIOUSLY_DROPPED_QUOTES = [
  "may not provide a ballot for an election for Federal office to an individual who desires to vote in person unless the individual presents to the official a valid physical photo identification",
  "the individual shall be permitted to cast a provisional ballot with respect to the election under section 302(a)",
  "may not accept any ballot for an election for Federal office provided by an individual who votes other than in person unless the individual submits with the ballot a copy of a valid photo identification",
  "shall take effect on the date that is 90 days after the date of the enactment of this Act",
] as const;
