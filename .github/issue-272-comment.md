## Progress update — Phase 0 + Phase 1 shipped on `feat/how-to-vote-screen`

Two commits pushed (d74b69f, 8630c20). Both build on the PR #292 branch as prior art, with every fabricated voting fact stripped out.

### Shipped

**The screen itself (Phase 1)**
- `/how-to-vote` route: methods, locations, and authority hand-offs derived from whatever `getVoterInfo` actually returned
- `utils/voting.ts` derivation model (ported from #292): fixed method order, `unknown` ≠ `unavailable`, steps gated entirely on a citable source, `registrationCheckUrl` always resolves (county tool → vote.gov)
- Components: `MethodCard`, `how-to-vote/parts` (StatusChip/FactRow/StepList/LocationList/LinkRow/UnavailableNote/SourceFooter), `HowToVoteEntryCard`
- Entry point on the Elections tab under the hero; bottom "Polling place" row now routes to `/how-to-vote` instead of `/local-elections`

**#301 (closes this box)**
- Offset rows (`electionDay-15` "Register by", `-8` "Ballots mailed") removed from `ElectionHero` and `KeyDatesSection`; only sourced Election Day remains
- `shiftDays` deleted; consumerless `earliestEarlyVoteStart` removed with its test

**Address entry is now native (no Google Places)**
- `expo-location` one-shot foreground fix + on-device reverse geocode (`useDeviceLocation`); typed entry kept as an equal path — GPS locates the voter, not necessarily their registration
- `places` router/lib and `GOOGLE_PLACES_API_KEY` deleted from the env registry, Next.js schema, and `.env.example`; launch docs updated
- "Verified on vote.gov" footer claim removed (Billion performs no such verification — epic scope-creep item)
- Bonus Windows fix: root `.env` never loaded because `next.config.js` passed `/C:/...` (`URL.pathname`) to `loadEnvConfig`; now `fileURLToPath`

### Honest-degradation rules enforced in code
- Missing locations → "Not published" chip, never "unavailable"
- No citable source → no steps; card degrades to pure routing
- Never asserts registration status; "What to bring" defers ID rules to the election office (#297's future slot)
- No date arithmetic anywhere in the voting model; deadline slots show "not available" (awaiting #294/#295/#296)

### Verified
Expo lint + typecheck, API typecheck, 126/126 expo tests, 39/39 API tests. Dev-only `electionsAreLive()` flip was reverted before push — the tab still parks until voter tools ship, so the screen is currently reachable by deep link.

### Still open on this epic
- #299 verification metadata (freshness/staleness for the kickers + footer)
- #300 de-risk Google Civic dependency (audit `codex/331-national-voting-logistics` first)
- #294–#298 data sources to fill the honest states
- Phase 4 cleanup: strip voting sections from `/local-elections`, move local bills to #282 (watch the `legistar.getMeetings` orphan), close #135 as superseded
