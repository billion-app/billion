# PR 369 native screenshots

The running Billion development app on an iPhone 17 Pro simulator, iOS 26.5. Metro served the code in commit `5bade6ab93360cc9a3bb010083106dcc33f8834b` on localhost:8139 with temporary synthetic route fixtures. The fixtures are excluded from the product commit.

All election content, candidate names, source names and URLs are synthetic. These captures demonstrate the native interface, not live election coverage.

## Default text size

The simulator content-size category was explicitly set to `large`, the iOS default (1.0 scale), before these captures:

- `measure-ios.png`: Original text selected, full supplied prose and blue source action. Screen title uses IBM Plex Serif Bold 34/38; reading heading uses Inria Serif Bold 16/19.
- `candidate-ios.png`: Candidate card uses Inria Serif Bold 16/19, grouped reading controls and blue contact action.
- `candidate-missing-ios.png`: Compact missing-data card with a 16/19 heading and white election-office action.

## Enlarged text, separate verification

`measure-large-text-ios.png` uses `accessibility-medium`. Text scaling remains enabled; the reading control stacks and preserves the selected original-text state. This image is not the default-size design reference.

The simulator was explicitly returned to default `large` after verification. The requested blue palette is retained; these screenshots do not claim WCAG contrast compliance.
