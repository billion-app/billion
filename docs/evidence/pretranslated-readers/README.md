# Prepared Chinese reader verification

Captured October 18, 2026, from the running Expo web app at a 390 × 844 viewport.
This is the actual development UI, with the local API using the existing
production article cache. The ready screenshot shows live California SB 492;
waiting and failure are explicitly injected translation API states. These are
not screenshots from an installed iOS binary.

- [Ready](ready.png): Chinese prose arrived in `getById`; no follow-up
  `getTranslation` request was needed.
- [Waiting](pending.png): the original English article was withheld while the
  translation was pending; the reader could wait, return, or choose English.
- [Failure](error.png): retry, English, and return remained available.

A browser mutation observer detected no English summary flash in these states.
The cold-start check used an English device locale, a saved Chinese preference,
and an injected four-second delay in the saved-language read. No article request
started before that read completed, and the subsequent first article response
was Chinese. This tests the saved-language race, not just a warm language switch.

The independent Astra screenshot review found the states understandable. The
large Return button is visually stronger than the inline Retry action; this
remains a minor hierarchy consideration. Header artwork was still loading in
the ready capture. Claude design consultation was attempted but unavailable due
to its session limit; no Claude approval is claimed.
