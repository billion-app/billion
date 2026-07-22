-- Remove all bills scraped from GovTrack, which overlaps with congress.gov
DELETE FROM bill WHERE source_website = 'govtrack';
