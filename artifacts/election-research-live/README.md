# Live server review

The preview reads `https://www.billion-news.app` through the normal Expo tRPC client (`civic.getCaliforniaGuide`). On October 11, 2026 that procedure returned 13 candidates and 14 measures for November 3, 2026. Fiona Ma (`lt-governor`) includes a statement, source URL, official portrait (`https://voterguide.sos.ca.gov/img/lt-governor/ma.jpg`), and office duties. A live read-only `ca-official-guide` collect on the same day returned the same counts, every candidate photo, and that portrait URL. No candidate JSON or reviewed fixture was supplied to the candidate route.

Actual native captures:

- [Elections tab, October 11](elections-tab-check.png): production guide loaded. Explore the guide is available.
- [Fiona Ma official portrait, October 11](fiona-photo-check.png): production guide match. Official SOS portrait, Lieutenant Governor, Democratic. Promises shows a statement. Background is still empty on production because `civic.getCandidateBackground` is not deployed.
- [Proposition 1, October 11](proposition-1-check.png): official Yes/No and SOS summary from the same guide.
- [Fiona Ma research cards, October 9](pr-fiona-top.png): earlier production capture of the four research cards.
- [Fiona Ma sourced background, October 9](fiona-background.png): local API with this branch. Background card shows a cited Wikipedia biography.
- [Fiona Ma overview, October 5](fiona-ma-overview.png): earlier capture of name, portrait, office, party, and office duties.
- [Fiona Ma statement, October 5](fiona-ma-statement.png): earlier capture from when the page still printed the statement inline. That reprint is no longer the page.

Production does not yet expose `civic.getCandidateBackground`. The official portrait comes from the guide scraper, not that procedure. This review is the statewide statement guide, not a complete personal ballot. Local `civic.getCaliforniaGuide` failed on this worktree because the local database could not read `civic_api_cache`. No production scrape write was performed.
