/** Production launch evidence is separate from provider configuration.
 * Keep this closed until #399, #332 and #418 have reviewed live evidence.
 * A key, successful response, or fixture is not coverage verification.
 */
export function getBallotAvailability() {
  return {
    status: "verification_required" as const,
    lookupEnabled: false as const,
    supportedAreas: [] as string[],
    officialBallotEvidence: [] as string[],
    productionMobileEvidence: [] as string[],
  };
}
