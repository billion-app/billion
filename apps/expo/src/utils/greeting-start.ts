/**
 * Home greeting ceremony: boot → wait → play → settled.
 *
 * Cold starts used to type behind the splash and the feed spinner. Facts
 * (splash, rail, foreground) are events; the phase is the only thing the
 * bar switches on. play/settled are sticky so a late fact cannot restart
 * a running typewriter.
 */

/** Hung splash/feed: start anyway rather than stalling on a dead request. */
export const GREETING_STAGE_WAIT_MS = 2500;
/** If the splash signal never fires (tests, web), do not wait forever. */
export const GREETING_SPLASH_FALLBACK_MS = 400;

export type CeremonyPhase = "boot" | "wait" | "play" | "settled";

export type CeremonyEvent =
  | { type: "decided"; play: boolean }
  | { type: "splashHidden" }
  | { type: "stageReady"; ready: boolean }
  | { type: "appActive"; active: boolean }
  | { type: "waitExpired" }
  | { type: "reduceMotion"; value: boolean }
  | { type: "freeze"; on: boolean }
  | { type: "finished" };

export type CeremonyState = {
  phase: CeremonyPhase;
  play: boolean;
  splashHidden: boolean;
  stageReady: boolean;
  appActive: boolean;
  waitExpired: boolean;
  reduceMotion: boolean;
  freeze: boolean;
};

export function initialCeremonyState(appActive: boolean): CeremonyState {
  return {
    phase: "boot",
    play: false,
    splashHidden: false,
    stageReady: false,
    appActive,
    waitExpired: false,
    reduceMotion: false,
    freeze: false,
  };
}

export function sheetVisible(phase: CeremonyPhase): boolean {
  return phase === "play" || phase === "settled";
}

function nextPhase(state: CeremonyState): CeremonyPhase {
  if (state.phase === "boot") return "boot";
  if (state.phase === "play" || state.phase === "settled") return state.phase;
  if (state.freeze) return "play";
  if (!state.play || state.reduceMotion) return "settled";
  if (!state.appActive) return "wait";
  if (state.waitExpired || (state.splashHidden && state.stageReady)) {
    return "play";
  }
  return "wait";
}

function applyFacts(
  state: CeremonyState,
  patch: Partial<CeremonyState>,
): CeremonyState {
  const next = { ...state, ...patch, phase: state.phase };
  next.phase = nextPhase(next);
  return next;
}

export function ceremonyReducer(
  state: CeremonyState,
  event: CeremonyEvent,
): CeremonyState {
  switch (event.type) {
    case "decided":
      // Re-enter wait so a new day-part can play after a settled morning.
      return applyFacts(
        { ...state, phase: "wait", play: event.play },
        { play: event.play },
      );
    case "splashHidden":
      if (state.splashHidden) return state;
      return applyFacts(state, { splashHidden: true });
    case "stageReady":
      if (state.stageReady === event.ready) return state;
      return applyFacts(state, { stageReady: event.ready });
    case "appActive":
      if (state.appActive === event.active) return state;
      return applyFacts(state, { appActive: event.active });
    case "waitExpired":
      if (state.waitExpired) return state;
      return applyFacts(state, { waitExpired: true });
    case "reduceMotion":
      if (state.reduceMotion === event.value) return state;
      return applyFacts(state, { reduceMotion: event.value });
    case "freeze":
      if (state.freeze === event.on) return state;
      return applyFacts(state, { freeze: event.on });
    case "finished":
      if (state.phase !== "play") return state;
      return { ...state, phase: "settled" };
    default:
      return state;
  }
}
