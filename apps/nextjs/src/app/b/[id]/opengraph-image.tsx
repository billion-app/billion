import { ImageResponse } from "next/og";

import { brandFonts } from "~/app/_lib/og-fonts";
import { OgCard } from "./share-card";
import { getSharedContent } from "./shared-content";

export const alt = "A Billion brief on a public record";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card a shared link unfurls into.
 *
 * This is the whole reason `/b/…` is worth linking to instead of the App
 * Store: in a group chat it arrives as a readable headline rather than a naked
 * URL, and that is the difference between being forwarded and being ignored.
 */
export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const content = await getSharedContent(id);
  // The page 404s for the same id; an image route has nothing better to say.
  if (!content) return new Response("Not found", { status: 404 });

  return new ImageResponse(<OgCard content={content} />, {
    ...size,
    fonts: await brandFonts(),
  });
}
