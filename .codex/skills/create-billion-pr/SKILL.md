---
name: create-billion-pr
description: Create a Billion pull request with implementation evidence, independent Astra code review and UI design review when relevant, verification, and an honest merge handoff.
---

# Create a Billion PR

Use this for a Billion change headed to a pull request, whether it is one feature or one part of a parallel effort. This skill owns the per-PR loop; [parallel feature delivery](../parallel-feature-delivery/SKILL.md) coordinates multiple threads and integration. It does not authorize merging or publishing.

1. Read `AGENTS.md`, the issue or request, the relevant repository guides, and `CONTRIBUTING.md`. Confirm the base branch, ownership, existing changes, and acceptance criteria. Work in an isolated checkout when needed, preserving unrelated work.
2. Implement the requested behavior and verify it at the right boundary. Run focused tests and applicable `CONTRIBUTING.md` checks. For data-facing changes, trace source to API to displayed state and distinguish live data from fixtures or generated explanations. For production-only Expo behavior, check a production bundle or runtime.
3. For UI changes, capture the running app in representative states and viewports, including an important empty or error state when relevant. Label the build, data source, and fixture status. A mockup or generated image may explain a proposal, but is not evidence that the implementation renders correctly.
4. Open a draft PR with the issue link, intended behavior, verification results, known risks, and actual UI screenshots when applicable. Attach the PR to the Codex task. Keep unverified or editorially blocked work in draft.
5. Ask an independent `gpt-6-astra` reviewer to assess the diff against the request and repository constraints. For reader-facing UI, use fresh reviewer context and first show the actual screenshots and the reader's task without the implementation rationale. Ask what the reviewer understands at a glance, what they would do next, and which copy, hierarchy, contrast, or interaction makes that difficult. For explanatory screens, have the reviewer answer the core comprehension question from the screen alone. Then provide the diff and checks for correctness, regressions, missing tests, accessibility, source attribution, and responsive behavior. Do not steer the reviewer toward approval or substitute a self-review.
6. Resolve actionable findings, rerun affected checks, update screenshots if the UI changed, and ask Astra to re-review the changed screen and diff. No clipping or overflow is a layout check, not proof of readability or comprehension. If the reviewer cannot understand the main point, or real-reader comprehension remains a required but unrun gate, keep the PR draft and state that limit. Surface unresolved findings and their impact in the PR. Do not mark ready while a critical defect, broken data provenance, or required editorial decision remains open.
7. When review and CI are complete, update the PR body with exact checks and outcomes, screenshot links, review findings and resolutions, and remaining limitations. Report the PR as ready or blocked. Merge, OTA, deployment, and worktree cleanup follow their own authorization and repository procedures.

If Astra or a required runtime is unavailable, record what was not reviewed or verified instead of treating a substitute as equivalent.
