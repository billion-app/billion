# Voting plan evidence

These are screenshots of the implemented Expo web app at 390 × 844, taken on
October 2, 2026. The guide tRPC response was intercepted with a synthetic empty
California guide dated November 3, 2026; no provider, database writes or generated
content were used. The missing-data state returns no guide. These are runtime
screenshots, not design mockups or evidence of live personalized logistics.

- `plan-registration.png`: first-time/existing/unsure registration next actions.
- `plan-mail.png`: mail preference with request, postmark and receipt distinguished.
- `plan-next-action.png`: official office and ballot-tracking handoff.
- `plan-in-person.png`: in-person preference and location/hours next action.
- `plan-missing-data.png`: no guide, with official actions preserved.
- `plan-enlarged-browser-text.png`: text enlarged to 160% in the browser. This does
  not verify native Dynamic Type or VoiceOver.

The running browser also confirmed preference restoration after reload, in-person
conditional guidance and a reset to Unsure after changing the synthetic election
to May 4, 2027. No page exceptions occurred in that session. Full native production
flow, source availability, real-reader comprehension and editorial review remain
gates for issue #422.
