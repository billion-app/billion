export const CONTENT_IMAGE_BUCKET = "content-images";
export const CONTENT_IMAGE_CACHE_SECONDS = 31_536_000;

export type ContentImageType = "bill" | "government_content" | "court_case";

export interface ContentImageCandidates {
  sourceThumbnailUrl?: string | null;
  videoThumbnailUrl?: string | null;
  generatedImagePath?: string | null;
  legacyImageUrl?: string | null;
}

function firstNonEmpty(
  ...values: readonly (string | null | undefined)[]
): string | undefined {
  return values.map((value) => value?.trim()).find(Boolean);
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
  const origin = supabaseUrl?.trim().replace(/\/+$/, "");
  if (!origin || !storagePath) return undefined;
  return `${origin}/storage/v1/object/public/${CONTENT_IMAGE_BUCKET}/${encodeStoragePath(storagePath)}`;
}

/**
 * One delivery contract for every content surface:
 * source thumbnail -> generated Storage object -> rollout-only blob endpoint.
 */
export function resolveContentImageUrl(
  candidates: ContentImageCandidates,
  supabaseUrl: string | undefined = process.env.SUPABASE_URL,
): string | undefined {
  return firstNonEmpty(
    candidates.sourceThumbnailUrl,
    candidates.videoThumbnailUrl,
    contentImagePublicUrl(supabaseUrl, candidates.generatedImagePath),
    candidates.legacyImageUrl,
  );
}
