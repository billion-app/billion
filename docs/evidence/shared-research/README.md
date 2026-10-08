# Private search trial, October 7, 2026 (Pacific)

[Captured output](search-trial.json) compares the same three queries through the
private SearXNG instance on Big Mac and Tavily basic search. It opens the first
two results per provider/query with the production source-reader code. This is
real discovery and page retrieval, not a fixture, model-generated review or
production scraper run. It writes no database and uses three Tavily credits.

The configured SearXNG instance returned six readable sampled pages; Tavily
returned five. One Tavily Ballotpedia page had insufficient readable text. All
successfully read pages contained the query's three topic terms. These counts
measure this small sample only. They do not establish general recall, balanced
arguments, factual accuracy or sustained uptime.

SearXNG surfaced official Texas Legislature analysis for SB 1 and the California
Legislative Analyst's Proposition 1 fiscal analysis. Its SAVE Act results included
an Institute for Responsive Government analysis and a publisher whose authority
was not independently established by this trial. The research model still has to
assess authority, distinguish attributed advocacy from facts, and find evidence
for each perspective. A topic match alone does not approve a citation.

Initial configurations failed or were weak: DuckDuckGo returned CAPTCHA, Brave
returned rate limiting, and enabling Bing alone produced generic California
pages for a specific housing-bond query. Explicitly enabled Yahoo and Startpage
were added to the pinned configuration before the captured comparison; Google
also reported access denial. The outcome depends on working upstream engines.
No CAPTCHA solving or rate-limit bypass was performed.

The trial does not switch the production search provider. The user-paused
supervisor remains stopped. Repeat the bounded comparison from the scraper
operations guide before resuming production with a different provider.
