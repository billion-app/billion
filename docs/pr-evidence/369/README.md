# PR 369 native comparison

These are screenshots of the running Billion development app on an iPhone 17 Pro simulator, iOS 26.5, using code from `39d5f924cad8e58aa53f68edc993fa87ce3a4a9b`.

The actual article-detail route and BillBrief components rendered a synthetic `content.getById` response from localhost:8158. The measure and candidate routes rendered temporary synthetic route fixtures through Metro on localhost:8159. No production data was queried. Fixture files are excluded from the product commit.

All titles, candidate names, prose, source names and URLs are synthetic. These images demonstrate the actual native components, not live election coverage.

## Default-size comparison

The simulator used `large`, the iOS default text-size category, for all three comparison images:

- `article-ios.png`: Existing article reading layout, including its summary, source control and context disclosure.
- `measure-ios.png`: Supplied short summary first, distinct extended summary on demand, fiscal context and argument disclosures.
- `candidate-ios.png`: Separate candidate identity, statement summary, optional biography, and named website action with hostname.
- `measure-original-only-ios.png`: Original text opens directly when no overview is supplied, with its source action above the ink reading panel.

Editorial page titles use IBM Plex Serif Bold 30/34; summary headings use Inria Serif Bold 17/22; summary prose uses Albert Sans 15/23. The shared article segmented control now has intrinsic height, 44-point minimum targets and selected accessibility state. Its blue selection uses navy text for contrast. Blue actions on navy have a calculated contrast ratio of 4.81:1.

The article's black status bar on navy is an existing route behavior in this simulator configuration; article source and domain logic were not changed for the comparison.

## Enlarged verification

`measure-large-text-ios.png`, `candidate-contact-large-text-ios.png`, and `article-large-text-ios.png` use `accessibility-medium`. Text scaling remains enabled. Controls stack, paragraphs remain readable, and the candidate website action uses a readable title and hostname while retaining the full validated URL as its destination and accessibility label. Long title words may naturally break across lines at this scale.

Native interactions verified original statement switching, original-only measure access, full supplied extended summary, full biography including its concluding sentence, and candidate website navigation to Safari. Two independent reviewers compared the actual article and ballot captures against the supplied design references and found no remaining actionable issues in the inspected states. This evidence does not claim a full VoiceOver or live-provider audit.

The simulator was returned to the default `large` text-size category after verification.
