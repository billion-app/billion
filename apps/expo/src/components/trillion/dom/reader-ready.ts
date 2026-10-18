declare const document: {
  body: { getBoundingClientRect(): unknown };
  fonts: { ready: Promise<unknown> };
};

/** Keep native placeholders until the DOM's final typography has reached a painted frame. */
export async function afterReaderPaint(
  stylesheet: Promise<unknown>,
  signal: AbortSignal,
  onReady: () => void,
  useFallbackFonts: () => void,
) {
  const isAborted = () => signal.aborted;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const fonts = stylesheet.then(async () => {
    if (isAborted()) return;
    // Flush the new stylesheet so its font requests exist before reading fonts.ready.
    document.body.getBoundingClientRect();
    await document.fonts.ready;
  });
  // Typography must not block an already loaded measure indefinitely. Lock in
  // system fonts on timeout so a late download cannot reflow the visible page.
  await Promise.race([
    fonts.catch(() => {
      if (!isAborted()) useFallbackFonts();
    }),
    new Promise<void>((resolve) => {
      timeout = setTimeout(() => {
        if (!isAborted()) useFallbackFonts();
        resolve();
      }, 2000);
    }),
  ]);
  clearTimeout(timeout);
  if (isAborted()) return;
  document.body.getBoundingClientRect();
  // The first callback runs before paint; the second follows that painted frame.
  requestAnimationFrame(() => {
    if (isAborted()) return;
    requestAnimationFrame(() => {
      if (!isAborted()) onReady();
    });
  });
}
