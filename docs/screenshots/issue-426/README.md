# Proposition consequence evidence

These PNGs show the running Expo web route at 390 × 844 using fictional tRPC responses intercepted by Playwright. Names, wording and approval metadata are synthetic; no live or editorially approved proposition is represented. `*-both-outcomes.png` captures the scrolled Yes/No cards. The sparse fixture omits official outcomes, summary and fiscal analysis. Enlarged text uses a browser CSS override at 150%; it is not native Dynamic Type validation.

Reproduce from the repository root after starting Expo web on port 8096 with `EXPO_PUBLIC_API_URL=http://localhost:8096`:

```bash
node scripts/capture-proposition-evidence.cjs
```

The capture script asserts the consequence headings and official fallback render. It sets onboarding completion only in the isolated browser context and intercepts all tRPC calls; no database writes or provider requests occur. Production native runtime verification and real-reader comprehension remain required gates.

The second design iteration also captures the ordinary official-only state, guide failure and expanded source review. Initial viewport screenshots reset the scroll view to the top after each response change. The script checks that the complete No outcome fits the initial 390 × 844 approved-fixture viewport, the sparse official-guide action is visible, and official title, implementation and source disclosures open. Readability review is separate from these assertions.

The final capture uses two affected-group statements with different sources. It opens each source’s “Cited statements”, checks the complete supported statement, and rejects the other source’s statement. The bond’s comparison includes a reviewed-style conditional repayment note; this synthetic text is not a published proposition claim. No native accessibility or real-reader validation is implied.
