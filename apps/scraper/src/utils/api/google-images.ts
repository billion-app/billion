/**
 * Google Custom Search API integration
 * Searches for relevant images using Google's Custom Search API
 * Falls back to OpenAI DALL-E image generation if search fails
 */

import { openai } from '@ai-sdk/openai';
import { experimental_generateImage as generateImage } from 'ai';
import type { ImageResult } from '../types.js';

/**
 * Generate an image using OpenAI DALL-E
 * @param query - Image generation prompt
 * @returns Generated image URL or null if generation fails
 */
async function generateImageWithAI(query: string): Promise<string | null> {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    console.warn('OPENAI_API_KEY not set, cannot generate images');
    return null;
  }

  try {
    console.log(`Generating image with AI for query: ${query}`);
    const { image } = await generateImage({
      model: openai.image('dall-e-3'),
      prompt: `A high-quality, professional image representing: ${query}`,
      size: '1024x1024',
    });

    // Convert base64 to data URL or use the URL if available
    if ('base64' in image) {
      return `data:image/png;base64,${image.base64}`;
    }
    // Type assertion for URL property that might exist in the response
    return (image as any).url || null;
  } catch (error) {
    console.error('Error generating image with AI:', error);
    return null;
  }
}

/**
 * Search for relevant images based on keywords using Google Custom Search
 * Falls back to AI image generation if Google Search is not configured or fails
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
    console.warn(
      'GOOGLE_API_KEY or GOOGLE_SEARCH_ENGINE_ID not set, falling back to AI image generation',
    );
    const imageUrl = await generateImageWithAI(query);
    if (imageUrl) {
      return [
        {
          url: imageUrl,
          alt: `AI-generated image for ${query}`,
          source: 'OpenAI DALL-E',
          sourceUrl: imageUrl,
        },
      ];
    }
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Check for quota exceeded error (403)
      if (response.status === 403 || response.status === 429) {
        console.warn(
          `⚠️  Google Image Search quota exceeded or rate limited (${response.status}). Skipping image search.`
        );
      } else {
        console.error(
          `Google Custom Search API error: ${response.status} ${response.statusText}`,
        );
        console.error('Error details:', errorData);
      }
      return [];
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.log(
        `No images found for query: ${query}, falling back to AI generation`,
      );
      const imageUrl = await generateImageWithAI(query);
      if (imageUrl) {
        return [
          {
            url: imageUrl,
            alt: `AI-generated image for ${query}`,
            source: 'OpenAI DALL-E',
            sourceUrl: imageUrl,
          },
        ];
      }
      return [];
    }

    return data.items.slice(0, count).map((item: any) => {
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
    console.error('Error searching for images:', error);
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
