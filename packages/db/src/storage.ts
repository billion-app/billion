import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "images";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for storage",
    );
  }
  return createClient(url, key);
}

/**
 * Upload an image buffer to object storage.
 * @param path - Storage path (e.g. "videos/abc-123.jpg")
 * @param data - Raw image bytes
 * @param mimeType - MIME type (default "image/jpeg")
 * @returns Public URL of the uploaded image
 */
export async function uploadImage(
  path: string,
  data: Buffer,
  mimeType = "image/jpeg",
): Promise<string> {
  const supabase = getClient();

  const { error } = await supabase.storage.from(BUCKET).upload(path, data, {
    contentType: mimeType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Storage upload failed for ${path}: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return publicUrl;
}

/**
 * Delete an image from object storage.
 * @param path - Storage path to delete
 */
export async function deleteImage(path: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    throw new Error(`Storage delete failed for ${path}: ${error.message}`);
  }
}
