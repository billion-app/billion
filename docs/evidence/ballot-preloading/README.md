# Idle ballot preloading verification

Verified on October 18, 2026 with an iOS 26.5 simulator and a development build of the Expo app. The guide and graph requests used the public production API. The development reader can use checked-in pilot graphs if a published graph is unavailable. These screenshots verify navigation and rendering, not editorial provenance or production device performance.

The [native trace](native-trace.txt) records temporary logging around the actual idle queue, plus the existing tRPC request logger. The temporary logging was removed after verification.

- No graph preload started while Statements was selected.
- Selecting Measures started one request inside an idle callback.
- Opening Proposition 3 during the first preload navigated immediately. The guide stopped scheduling on blur and let the existing request finish.
- Returning to the guide resumed the queue. Each next item began in a new idle callback after the previous item finished.
- Opening the warmed Proposition 2 made no additional graph request. The reader retained its skeleton while its WebView initialized, then displayed the content.

The simulator controller's drag acted as a tap, both with and without the new event handlers. Native drag and momentum behavior remains unverified. The 11 automated tests cover the queue's pause, cancellation, cache reuse, stale data, and failure behavior. Android was bundled in CI but not exercised interactively. No measured responsiveness claim is made.

[Measure list](guide.png) · [Warmed reader](reader.png)
