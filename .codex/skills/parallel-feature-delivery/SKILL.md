---
name: parallel-feature-delivery
description: Coordinate explicitly requested parallel Billion feature work in isolated Codex threads and worktrees through PRs, independent review, real UI screenshots, and an integrated release decision.
---

# Parallel feature delivery

Use this when the user asks to run multiple Billion features in parallel with Codex threads. Read `AGENTS.md`, the relevant issue bodies, and `CONTRIBUTING.md`. This skill coordinates delivery; domain and release guides still own their procedures.

## Dispatch

1. Check the primary checkout, issue status, active threads, and attached worktrees. Do not replace in-progress work. Identify dependencies and give each feature a distinct file or behavior owner; call out shared contracts before dispatch.
2. Create a separate project worktree thread for each user-authorized feature, starting from current `main` unless the user specifies another base. State the issue, acceptance criteria, ownership boundary, data/provenance constraints, checks, PR target, and screenshot requirement in the initial prompt. Do not create user-visible threads for unrequested subtasks.
3. Keep the integration and release owner explicit. Parallel authors must not each publish production updates. If an issue is research-only or blocked by data, licensing, or editorial approval, ask for a prototype or reviewable plan rather than claiming a live feature.

## Per-thread completion

Each implementation thread should:

- Verify the actual data path and user flow, including empty, error, and partial states. Never pass a fixture or generated image off as production data or an app screenshot.
- Run focused tests and the applicable checks in `CONTRIBUTING.md`; for production-only Expo behavior, also verify a production bundle or runtime.
- Capture screenshots from the running UI at useful mobile states. Record exact paths or attach them to the PR, with the source and any fixture status labeled. A design simulation may supplement but cannot replace a runtime capture.
- Open and attach a PR. Request independent review with the user-requested model (Astra for this workflow) across code, UX, accessibility, source attribution, and tests. Resolve findings, then ask for a re-review of the changed diff. A self-review is not independent review.
- Merge only after CI and review gates pass and the feature is safe to publish. Leave a blocked PR open with a precise blocker; do not force a merge merely to finish the batch.

## Integrate and report

Track the threads with `wait_threads` rather than repeatedly polling their full histories. When PRs touch shared contracts, merge in dependency order, update remaining branches, and rerun affected integration checks. Confirm the merged commit and live data path; a green unit test or screenshot alone does not prove end-to-end behavior.

Before any production OTA, TestFlight build, scraper deploy, migration, or credential change, use the appropriate repository guide and the authorization in the current request. Distinguish merged code, published update, downloaded update, and verified running app. Do not publish a second update for a commit already released.

Finish with links to each issue, PR, review outcome, and screenshot, plus a compact status for merged, released, blocked, and unverified work. Keep the primary checkout and unrelated user changes intact; archive only worktrees that are no longer in use.
