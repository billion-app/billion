import type { ImageSource } from "expo-image";

import algorithmTransparencyImage from "../../assets/article-brief/algorithm-transparency.jpg";
import infrastructureRepairImage from "../../assets/article-brief/infrastructure-repair.jpg";
import publicTransitImage from "../../assets/article-brief/public-transit.jpg";

type EditorialImageSource = ImageSource | number;

const TITLE_VISUALS: Record<string, EditorialImageSource> = {
  "Infrastructure Modernization Act of 2025": infrastructureRepairImage,
  "TechCorp Inc. v. California": algorithmTransparencyImage,
  "Digital Privacy Protection Act": algorithmTransparencyImage,
};

/**
 * Local editorial art wins over generic seeded thumbnails. The fallback keeps
 * real scraper imagery working while preventing placeholder landscapes from
 * representing unrelated policy in the demo.
 */
export function editorialVisualFor(
  title: string,
  remoteUri?: string | null,
): EditorialImageSource | undefined {
  if (TITLE_VISUALS[title]) return TITLE_VISUALS[title];
  if (!remoteUri || remoteUri.includes("picsum.photos")) return undefined;
  return { uri: remoteUri };
}

export { publicTransitImage };
