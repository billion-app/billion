/**
 * The root layout renders the tree *under* the native splash, then fades it.
 * Home mounts during that overlap — greetings that start on mount are already
 * mid-typewriter by the time the user can see the screen.
 */
let hidden = false;
let resolveHidden: (() => void) | undefined;
const hiddenPromise = new Promise<void>((resolve) => {
  resolveHidden = resolve;
});

export function isSplashHidden(): boolean {
  return hidden;
}

export function whenSplashHidden(): Promise<void> {
  return hiddenPromise;
}

export function markSplashHidden(): void {
  if (hidden) return;
  hidden = true;
  resolveHidden?.();
}
