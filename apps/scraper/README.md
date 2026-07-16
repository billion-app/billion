# CA SOS Scraper Limitations

This scraper relies on HTML/PDF sources for candidate statements since no official SOS API endpoint exists for this data. Key limitations:

- Candidate statements, contact info, and office metadata are scraped from:
  - https://voterguide.sos.ca.gov/candidates/
  - https://vig.cdn.sos.ca.gov/2026/primary/pdf/complete-vig.pdf

- The official JSON feeds at https://media.sos.ca.gov only cover election results, not candidate statements

- PDF fallback is used when HTML sources are unavailable or unparsable
- Requires 9-office coverage validation in tests

## Source Attribution
All CaSosStatement records include:
- source_url (HTML/PDF location)
- election_year (from source discovery)
- office (normalized from OFFICE_SLUGS)