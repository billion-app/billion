# Voting plan evidence

These are screenshots of the implemented Expo web app at 390 × 844, taken on
October 2, 2026. The guide tRPC response was intercepted with a synthetic populated
California guide (24 fictional candidate rows) dated November 3, 2026; no provider, database writes or generated
content were used. The missing-data state returns no guide. These are runtime
screenshots, not design mockups or evidence of live personalized logistics.

- `plan-registration.png`: first-time/existing/unsure registration next actions.
- `plan-mail.png`: mail preference with request, postmark and receipt distinguished.
- `plan-next-action.png`: official office and ballot-tracking handoff.
- `plan-sparse-ballot.png`: actual How to Vote view with a sparse synthetic
  response missing normalized input, preserving official next actions and returning
  to the populated ballot with focus on the How to Vote entry.
- `plan-in-person.png`: in-person preference and location/hours next action.
- `plan-missing-data.png`: no guide, with official actions preserved.
- `plan-enlarged-browser-text.png` and `plan-enlarged-method.png`: text enlarged to 160% in the browser. This does
  not verify native Dynamic Type or VoiceOver.

The running browser also confirmed preference restoration after reload, in-person
conditional guidance, returning to the guide heading at scroll position 0 with
a populated guide and keyboard focus on its heading, and a reset to Unsure after changing the synthetic election
to May 4, 2027. No page exceptions occurred in that session. Full native production
flow, source availability, real-reader comprehension and editorial review remain
gates for issue #422.

Fresh independent Astra screenshot-first design and code review found no remaining
actionable defects after iteration. This is automated review; it does not replace
the outstanding real-reader, editorial, native accessibility or production gates.
