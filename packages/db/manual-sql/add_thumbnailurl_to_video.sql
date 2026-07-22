-- Add thumbnailUrl column to video table for hybrid image support
-- This allows videos to store either AI-generated binary images (imageData) or
-- URL-based scraped thumbnails (thumbnailUrl) from source content

ALTER TABLE video ADD COLUMN thumbnail_url TEXT;

-- Create index for performance when filtering by thumbnail_url presence
CREATE INDEX video_thumbnail_url_idx ON video(thumbnail_url) WHERE thumbnail_url IS NOT NULL;

-- Backfill thumbnailUrl from source tables for existing video records
-- This populates the new field with URLs from the original content sources

UPDATE video v
SET thumbnail_url = b.thumbnail_url
FROM bill b
WHERE v.content_type = 'bill' AND v.content_id = b.id;

UPDATE video v
SET thumbnail_url = gc.thumbnail_url
FROM government_content gc
WHERE v.content_type = 'government_content' AND v.content_id = gc.id;

UPDATE video v
SET thumbnail_url = cc.thumbnail_url
FROM court_case cc
WHERE v.content_type = 'court_case' AND v.content_id = cc.id;
