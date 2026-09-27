/**
 * The home greeting is a one-shot per day-part. Starting it as soon as the
 * bar mounts burns the animation behind the splash and the feed spinner, so
 * cold starts only catch the settle. Hold until the surface is actually
 * visible, then persist "seen" at the moment play begins.
 */

/** Hung splash/feed: start anyway rather than stalling on a dead request. */
export const GREETING_STAGE_WAIT_MS = 2500;
/** If the splash signal never fires (tests, web), do not wait forever. */
export const GREETING_SPLASH_FALLBACK_MS = 400;

export function ceremonyShouldHold(input: {
  play: boolean;
  freeze: boolean;
  reduceMotion: boolean;
  stageReady: boolean;
  splashHidden: boolean;
  appActive: boolean;
  waitExpired: boolean;
}): boolean {
  if (input.freeze) return false;
  if (!input.play || input.reduceMotion) return false;
  // A backgrounded launch must not consume the ceremony unseen.
  if (!input.appActive) return true;
  if (input.waitExpired) return false;
  return !input.splashHidden || !input.stageReady;
}
