# Live server review

The preview reads `https://www.billion-news.app` through the normal Expo tRPC client (`civic.getCaliforniaGuide`). On October 9, 2026 that procedure returned 13 candidates for the November 3, 2026 election, including Fiona Ma (`lt-governor`) with a statement, source URL, portrait, and office duties. No candidate JSON or reviewed fixture was supplied to the candidate route. The iPhone 17 development build opened `billion://candidate-detail?name=Fiona%20Ma&office=lt-governor`.

Actual native captures:

- [Fiona Ma research cards, October 9](pr-fiona-top.png): live guide match. Promises shows "Candidate statement available" without reprinting the statement. Background is "not supplied". Funding is "Donor records not connected". Office is "Office guide available".
- [Fiona Ma overview, October 5](fiona-ma-overview.png): earlier capture of name, portrait, office, party, and office duties.
- [Fiona Ma statement, October 5](fiona-ma-statement.png): earlier capture from when the page still printed the statement inline. That reprint is no longer the page.

The server does not supply background records or donor data. Those gaps stay explicit. This review is the statewide statement guide, not a complete personal ballot. Local `civic.getCaliforniaGuide` failed on this worktree because the local database could not read `civic_api_cache`. The phone build used production. No deployment or ingestion was performed.
