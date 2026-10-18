import { ImageResponse } from "next/og";

import { brandFonts } from "~/app/_lib/og-fonts";
import { readerLanguage } from "~/app/_lib/reader-language";
import { loadShareArt } from "../share-art";
import { OgCard, StoryCard } from "../share-card";
import { getLocalizedSharedContent } from "../shared-content";

/**
 * The 1080×1920 image the app hands to Instagram Stories.
 *
 * Rendered here rather than in the app so the card is one design in one place,
 * changeable without an App Store release, and so the phone only has to
 * download a PNG. The app fetches this URL, writes it to its cache, and opens
 * the system share sheet on the file.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const og = new URL(request.url).searchParams.get("format") === "og";
  const language = readerLanguage(
    new URL(request.url).searchParams.get("lang"),
  );
  const { content, pending } = await getLocalizedSharedContent(id, language);
  if (pending)
    return new Response("Translation pending", {
      status: 503,
      headers: { "Retry-After": "5", "Cache-Control": "no-store" },
    });
  if (!content) {
    return new Response("Not found", { status: 404 });
  }

  const [fonts, art] = await Promise.all([brandFonts(), loadShareArt(content)]);

  return new ImageResponse(
    og ? (
      <OgCard language={language} content={content} art={art} />
    ) : (
      <StoryCard language={language} content={content} art={art} />
    ),
    {
      width: og ? 1200 : 1080,
      height: og ? 630 : 1920,
      fonts,
      headers: {
        // A brief changes when the pipeline regenerates it, which is rare and
        // never urgent. An hour at the edge keeps a story that several people
        // share in the same evening from re-rendering for each of them.
        "Cache-Control":
          "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
