import { ImageResponse } from "next/og";

import { brandFonts } from "~/app/_lib/og-fonts";
import { StoryCard } from "../share-card";
import { getSharedContent } from "../shared-content";

/**
 * The 1080×1920 image the app hands to Instagram Stories.
 *
 * Rendered here rather than in the app so the card is one design in one place,
 * changeable without an App Store release, and so the phone only has to
 * download a PNG. The app fetches this URL, writes it to its cache, and opens
 * the system share sheet on the file.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const content = await getSharedContent(id);
  if (!content) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(<StoryCard content={content} />, {
    width: 1080,
    height: 1920,
    fonts: await brandFonts(),
    headers: {
      // A brief changes when the pipeline regenerates it, which is rare and
      // never urgent. An hour at the edge keeps a story that several people
      // share in the same evening from re-rendering for each of them.
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
