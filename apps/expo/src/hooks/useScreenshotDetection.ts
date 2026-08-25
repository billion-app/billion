import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as ScreenCapture from "expo-screen-capture";

/**
 * Calls `onScreenshot` when the reader screenshots the screen this hook is
 * mounted on.
 *
 * A screenshot is the most honest signal we get that something was worth
 * passing on: the reader wanted to show it to someone and the app gave them no
 * better way to do it. Catching that moment is the point — see
 * https://timmarinin.net/2026/bluesky-screenshots/ for the version of this
 * idea that puts branding *into* the image, which needs native code we do not
 * have yet.
 *
 * Deliberately never prompts for a permission. On Android 13 and below the
 * detector needs the photo-library permission; asking a civic app's reader for
 * access to their photos in order to notice a screenshot is a worse trade than
 * missing the event, so the listener is only attached where the permission is
 * already granted. Android 14+ grants it implicitly and iOS never needs it,
 * which covers nearly every device that runs this app.
 */
export function useScreenshotDetection(
  onScreenshot: () => void,
  enabled = true,
) {
  // Kept in a ref so a caller can pass an inline closure without detaching and
  // reattaching the native listener on every render.
  const callback = useRef(onScreenshot);
  useEffect(() => {
    callback.current = onScreenshot;
  }, [onScreenshot]);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;

    let subscription:
      | ReturnType<typeof ScreenCapture.addScreenshotListener>
      | undefined;
    // An object rather than a plain `let` so the read after the permission
    // check is not narrowed away: the effect can be torn down while that
    // check is still in flight.
    const teardown = { cancelled: false };

    void (async () => {
      try {
        const { granted } = await ScreenCapture.getPermissionsAsync();
        if (!granted || teardown.cancelled) return;

        subscription = ScreenCapture.addScreenshotListener(() =>
          callback.current(),
        );
      } catch {
        // Screenshot detection is an enhancement. A device that will not do it
        // simply does not, and the reader notices nothing.
      }
    })();

    return () => {
      teardown.cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);
}
