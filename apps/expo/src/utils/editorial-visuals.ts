import type { ImageSource } from "expo-image";

/**
 * Resolve the image for a piece of content, or nothing.
 *
 * This used to also map a handful of hardcoded *seeded* titles ("TechCorp Inc.
 * v. California", "Digital Privacy Protection Act") onto artwork bundled in the
 * app. That was demo scaffolding: it made screenshots look finished, and it
 * would have silently attached stock art to any real bill that happened to
 * share a title with the fixture. Production shows a real image or none.
 *
 * The picsum check stays: seeded rows carry placeholder landscape URLs, and a
 * random landscape is worse than an empty slot next to real legislation.
 */
export function contentImageSource(
  remoteUri?: string | null,
): ImageSource | undefined {
  if (!remoteUri || remoteUri.includes("picsum.photos")) return undefined;
  return { uri: remoteUri };
}
