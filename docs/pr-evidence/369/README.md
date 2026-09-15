# PR 369 native screenshots

The running Billion development app on an iPhone 17 Pro simulator, iOS 26.5. Metro served the code in commit `cdfc251cd9c53da43e9b506ca511aa8e150f0c74` on localhost:8149 with temporary synthetic route fixtures. The fixtures are excluded from the product commit.

All election content, candidate names, source names and URLs are synthetic. These captures demonstrate the native interface, not live election coverage.

## Default text size

The simulator content-size category was explicitly set to `large`, the iOS default (1.0 scale), before these captures:

- `measure-ios.png`: Overview and its AI label share a reading card; the original-text control stays above it. Supplied prose is preserved.
- `candidate-ios.png`: Long biography excerpt with an expansion action, statement controls, and navy-backed blue contact action.
- `measure-missing-ios.png`: Compact missing-data card and primary election-office recovery.
- `measure-original-only-ios.png`: Available original text opens directly when no overview is supplied.

Screen titles retain IBM Plex Serif Bold 34/38; card headings retain Inria Serif Bold 16/19. Blue `#4A7CFF` actions on navy `#0E1530` have a calculated contrast ratio of 4.81:1.

## Enlarged text, separate verification

`measure-large-text-ios.png` and `candidate-contact-large-text-ios.png` use `accessibility-medium`. Scaling remains enabled: reading controls stack, and the full contact URL wraps within its action. These images are not default-size design references.

Native interactions checked included original-only access, argument/source/language disclosures, biography expansion to its concluding sentence, enlarged collapse, and opening the candidate website in Safari. The simulator was explicitly returned to default `large` after verification. Two independent reviewers inspected the code and fresh native states and found no remaining actionable defects within the reviewed scope. This is not a full VoiceOver or live-provider audit.
