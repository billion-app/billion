/**
 * Google Custom Search API integration
 * Searches for relevant images using Google's Custom Search API
 */

import type { ImageResult } from '../types.js';
import { createLogger } from '../log.js';
import { trackGoogleSearch } from '../costs.js';

const logger = createLogger("images");

/**
 * Search for relevant images based on keywords using Google Custom Search
 * @param query - Search query (keywords)
 * @param count - Number of images to retrieve (default: 3, max: 10)
 * @returns Array of image results
 */
export async function searchImages(
  query: string,
  count: number = 3,
): Promise<ImageResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    logger.warn('GOOGLE_API_KEY or GOOGLE_SEARCH_ENGINE_ID not set, skipping image search');
    return [];
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', searchEngineId);
    url.searchParams.set('q', query);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('num', Math.min(count, 10).toString());

    const response = await fetch(url.toString());
    trackGoogleSearch();

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Check for quota exceeded error (403)
      if (response.status === 403 || response.status === 429) {
        logger.warn(`Google Image Search quota exceeded or rate limited (${response.status}), skipping`);
      } else {
        logger.error(`Google Custom Search API error: ${response.status} ${response.statusText}`);
      }
      return [];
    }

    const data = (await response.json()) as { items?: Array<{ link: string; title?: string; displayLink?: string; image?: { thumbnailLink?: string; contextLink?: string } }> };

    if (!data.items || data.items.length === 0) {
      logger.debug(`No images found for query: ${query}`);
      return [];
    }

    return data.items.slice(0, count).map((item) => {
      // Try to get the highest quality image available from Google's image object
      // Fall back to thumbnailLink if the original link doesn't work
      const imageUrl = item.image?.thumbnailLink || item.link;

      return {
        url: imageUrl,
        alt: item.title || `Image related to ${query}`,
        source: item.displayLink || 'Google Images',
        sourceUrl: item.image?.contextLink || item.link,
      };
    });
  } catch (error) {
    logger.error('Error searching for images', error);
    return [];
  }
}

/**
 * Get a single thumbnail image for an article
 * Returns the first/best image from search results
 * @param query - Search query
 * @returns Single image URL or null
 */
export async function getThumbnailImage(query: string): Promise<string | null> {
  const images = await searchImages(query, 1);
  return images.length > 0 ? images[0]!.url : null;
}
