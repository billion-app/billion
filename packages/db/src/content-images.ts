export const CONTENT_IMAGE_BUCKET = "content-images";
export const CONTENT_IMAGE_CACHE_SECONDS = 31_536_000;

export function supabaseStorageOrigin(
  explicitUrl: string | undefined = process.env.SUPABASE_URL,
  postgresUrl: string | undefined = process.env.POSTGRES_URL,
): string | undefined {
  if (explicitUrl?.trim()) return explicitUrl.trim().replace(/\/+$/, "");
  if (!postgresUrl) return undefined;

  try {
    const parsed = new URL(postgresUrl);
    const directMatch = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(
      parsed.hostname,
    );
    const poolerMatch = /^postgres\.([a-z0-9]+)$/i.exec(
      decodeURIComponent(parsed.username),
    );
    const projectRef = directMatch?.[1] ?? poolerMatch?.[1];
    return projectRef ? `https://${projectRef}.supabase.co` : undefined;
  } catch {
    return undefined;
  }
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function contentImagePublicUrl(
  supabaseUrl: string | undefined,
  storagePath: string | null | undefined,
): string | undefined {
  const origin = supabaseStorageOrigin(supabaseUrl);
  const path = storagePath?.trim();
  if (!origin || !path) return undefined;
  return `${origin}/storage/v1/object/public/${CONTENT_IMAGE_BUCKET}/${encodeStoragePath(path)}`;
}

export function resolveContentImageUrl(
  sourceThumbnailUrl: string | null | undefined,
  generatedImagePath: string | null | undefined,
  supabaseUrl: string | undefined = process.env.SUPABASE_URL,
): string | undefined {
  const sourceUrl = sourceThumbnailUrl?.trim();
  if (sourceUrl) return sourceUrl;
  return contentImagePublicUrl(supabaseUrl, generatedImagePath);
}
