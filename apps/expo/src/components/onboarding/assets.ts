/**
 * Stills already in the app — Digest + elections + onboarding documentary.
 * No new generated orbs.
 */
/* Metro needs require() for bundled raster assets. */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment */
export const PHOTO = {
  welcome: require("../../../assets/onboarding/onboard-capitol-twilight.png"),
  congress: require("../../../assets/onboarding/onboard-capitol-twilight.png"),
  state: require("../../../assets/onboarding/onboard-ca-capitol.png"),
  executive: require("../../../assets/digest/capitol.png"),
  courts: require("../../../assets/elections/civic-city-hall.jpg"),
  technology: require("../../../assets/onboarding/onboard-server-hall.png"),
  energy: require("../../../assets/onboarding/onboard-turbines.png"),
  fiscal: require("../../../assets/onboarding/onboard-port.png"),
  healthcare: require("../../../assets/onboarding/onboard-ambulance.png"),
  infrastructure: require("../../../assets/digest/arches.png"),
  defense: require("../../../assets/elections/neighborhood-street.jpg"),
  instant: require("../../../assets/onboarding/onboard-corridor.png"),
  evening: require("../../../assets/onboarding/onboard-desk.png"),
} as const;
