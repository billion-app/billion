# PR 369 native screenshots

The running Billion development app on an iPhone 17 Pro simulator, iOS 26.5. Metro served commit `09a15ffd8f8bee2f03ea69ae143c1ae97ebea087` on localhost:8119.

All election content, candidate names, source names and URLs are synthetic route-parameter fixtures. These captures demonstrate the native interface; they do not establish live election coverage or production-release acceptance.

- `measure-ios.png`: Overview, fiscal impact and original text appear in separate reading cards. The generated summary has an adjacent AI label.
- `candidate-ios.png`: Candidate biography, summary/original controls and collapsed evidence rows.
- `candidate-missing-ios.png`: The contest title stays visible above the unavailable-data message and election-office action.
- `measure-large-text-ios.png`: Complete title and reading card after changing Dynamic Type to accessibility-medium and navigating without restarting.

Warm text-size changes and navigation were checked in both directions. Candidate expansion and source disclosure remained usable. No live provider calls or data writes supplied the fixtures.
