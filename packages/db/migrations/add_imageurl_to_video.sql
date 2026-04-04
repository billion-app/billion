-- Add image_url column to video table for object storage URLs
-- This stores the public URL of AI-generated images uploaded to Supabase Storage / S3

ALTER TABLE video ADD COLUMN IF NOT EXISTS image_url TEXT;
