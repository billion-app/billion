---
name: release-billion-testflight
description: Build, submit, replace, or check a Billion iOS TestFlight release, or publish a production OTA. Use for mobile version bumps, EAS builds, App Store Connect submission, production OTA updates, and release-status verification.
---

# Release Billion iOS and production OTA updates

Read [the iOS release guide](../../../docs/ios-release.md) for commands and fallback procedures. Complete the requested release through build and submission monitoring. Distinguish an EAS build, an accepted Apple upload, completed Apple processing, and tester availability.

For a production OTA, complete step 1, then follow **Production OTA: merge before publishing** below instead of the TestFlight version/build/submission steps. A status-only request requires inspection and a report, not a new release.

## 1. Establish the release source and acceptance criteria

Inspect the working tree, recent commits, tags, `apps/expo/app.config.base.json`, and `apps/expo/eas.json`. Verify identifiers from those files against the signed-in EAS project and App Store Connect. Run EAS commands from `apps/expo`.

Before implementing a release fix, creating a release branch, or opening a PR, search existing open, merged, and closed PRs using the symptom, affected feature, branch, and known commits. Read relevant diffs and merge status rather than relying on titles. Continue a matching open PR; for a merged PR, verify whether its fix is already present and identify any remaining gap; for a closed unmerged PR, inspect why it was closed before reusing its approach. Record the relevant PR links or that no matching PR was found. Use [Create a Billion PR](../create-billion-pr/SKILL.md) when a fix needs a new or updated PR.

Preserve unrelated changes and stage only intended release files. Build from an exact commit or tag in a clean worktree with its own real install. Linked `node_modules` can break native fingerprint parity.

Extract the behavior the user wants shipped. A status-only request needs inspection and a report, not a new version or build. For a new release, define a check for each requested change before spending a build. Navigation checks must cover both Expo Router options and the custom tab renderer; environment-gated behavior needs a production bundle or runtime check.

Done when the PR search, source, target app, release path, and behavior checks are recorded.

## 2. Validate the release

Follow [release preflight](../../../docs/ios-release.md#release-preflight). Verify the canonical API URL against committed production configuration and EAS production. Show only public values; inspect secret settings by presence without printing credentials. Verify the live site and at least one public app API request, plus the relevant session flow for authentication changes.

Require mobile typecheck, lint, Expo Doctor, and the production iOS export to pass. Native dependency, plugin, or app-configuration changes also require prebuild validation. Resolve missing native peers, SDK mismatches, duplicate native modules, and config errors before building.

Done when the preflight and release-specific checks pass, with evidence for the behavior being shipped.

## Production OTA: merge before publishing

1. Complete the fix's PR review and required checks, and merge it into `main` under the user's existing authorization. Immediately before dispatching the production release, verify GitHub reports the PR as merged into `main`, fetch the current remote `main`, and verify it contains the fix. Account for squash or rebase merges by checking the resulting main commit and code; an original branch SHA need not be an ancestor. An open PR, a pushed release branch, or a successful preview deployment does not satisfy this gate. If review, CI, merge authorization, or integration is unresolved, stop before publishing and report the blocker. Do not publish first and defer the merge.
2. Prefer an exact merged `main` commit as the OTA source. If newer native changes on `main` prevent compatibility with the installed store build, follow the guide's compatibility-backport path: branch from the compatible release source and cherry-pick only fixes already merged into `main`. The workflow requires exact patch equivalents and rejects source-only merges or adjusted patches; after a squash merge, cherry-pick the resulting main commit. Record the main commit and corresponding backport commit, and verify the released behavior exists in both. A compatibility branch may have different ancestry, but must never be the fix's only home. Run [release validation](#2-validate-the-release) on the final release source; rerun affected checks if integration or backporting changes that source.
3. Follow [Production OTA updates](../../../docs/ios-release.md#production-ota-updates). Keep the fingerprint policy and runtime compatibility guard intact, and dispatch the guarded production workflow from `main`, using the full `source_sha` input when releasing a compatibility backport. Confirm the GitHub `Production` environment permits only the `main` branch so an older branch workflow cannot skip the guard. Verify the workflow's source SHA matches that commit. If no compatible store build exists, stop the OTA path and use the new-binary release path when authorized; do not weaken the guard.
4. Monitor the workflow through successful publication, then verify the production update endpoint serves the published update ID for the intended platform, channel, and runtime. Record the PR URL, main integration commit, OTA source commit, workflow URL, update group/ID, compatible app/build, and runtime. Distinguish publication from installation on a physical device. Preserve unrelated work and clean up the temporary release checkout after verification.

Done when the fix is verified on remote `main` and the intended production OTA is published and served. A published update without main integration is incomplete.

## 3. Version once and choose the build owner

Follow [TestFlight through CI](../../../docs/ios-release.md#testflight-through-ci). The bump script edits, commits, and tags; do not duplicate those operations. Review the staged diff before using it. EAS owns the remote iOS build number.

Pushing a `v*` tag starts `release-ios.yml`, which builds and submits. Inspect the workflow and EAS builds for the exact tag before starting anything manually. If CI is running or has succeeded, proceed to monitoring.

If CI cannot complete the release, state the reason and use the [manual EAS fallback](../../../docs/ios-release.md#manual-eas-fallback). Use the [local Xcode fallback](../../../docs/ios-release.md#local-xcode-fallback) when EAS quota or infrastructure prevents a build. Retain the same clean source, preflight, signing, and submission checks. For a local upload, choose an unused App Store build number and synchronize EAS's remote number afterward.

Done when one build path owns the exact release and its build/submission identifiers or local archive path are recorded.

## 4. Monitor and finish

Follow [build and submission verification](../../../docs/ios-release.md#verify-build-and-submission). On recoverable failure, inspect the current logs, correct the cause, rerun the relevant checks, and continue. Interactive Apple login, two-factor prompts, or agreements may require the account holder.

Verify Apple processing directly when a signed-in session is available. Otherwise report the accepted upload and pending or unverified processing state; do not claim tester availability without evidence.

Before finishing, verify:

- Release commit and tag, marketing version, and build number.
- Completed build and submission, or the precise remaining account/processing gate.
- Production API URL and checks for every requested behavior change.
- Unrelated working-tree changes preserved.

Remove the temporary worktree after monitoring completes. Report version/build and direct build, submission, and TestFlight links where available. For status-only requests, report the observed state and identifiers without creating release artifacts.
