import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { Video } from "@acme/db/schema";

export const dynamic = "force-dynamic";

/**
 * Temporary rollout fallback. It keeps legacy bytea payloads out of tRPC JSON:
 * Postgres is read only when an old image is actually requested. Once verified
 * backfill cleanup completes, these rows naturally return 404 and this route
 * can be removed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const [video] = await db
    .select({
      imageData: Video.imageData,
      imageMimeType: Video.imageMimeType,
    })
    .from(Video)
    .where(eq(Video.id, videoId))
    .limit(1);

  if (!video?.imageData || !video.imageMimeType) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(video.imageData), {
    headers: {
      "Content-Type": video.imageMimeType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
