import { GoogleGenerativeAI, type GenerativeModel, type Part } from '@google/generative-ai';
import * as fs from 'fs';

export interface GeminiOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CaptionGenerationInput {
  title: string;
  description: string;
  contentType: string;
  imageAnalysis?: string;
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private options: Required<GeminiOptions>;

  constructor(apiKey: string, options: GeminiOptions = {}) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.options = {
      model: options.model ?? 'gemini-2.5-flash',
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 500,
    };

    this.model = this.genAI.getGenerativeModel({
      model: this.options.model,
      generationConfig: {
        temperature: this.options.temperature,
        maxOutputTokens: this.options.maxTokens,
      },
    });
  }

  async analyzeImage(imagePath: string): Promise<string> {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const imageBase64 = imageBuffer.toString('base64');

      const prompt = `
        Analyze this screenshot from a mobile news app. Describe:
        1. The main visual elements (text, images, layout)
        2. The type of content (bill, court case, government order, general news)
        3. Key information visible (title, description, badges)
        4. The overall tone and visual style

        Be concise but informative. Focus on what would be interesting for social media.
      `;

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64,
          },
        },
      ]);

      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error analyzing image with Gemini:', error);
      throw error;
    }
  }

  async generateCaption(input: CaptionGenerationInput): Promise<string> {
    const prompt = `
      You are a social media manager for Billion, a civic tech news app that covers legislation, court cases, and government actions.

      Create an engaging social media caption for the following content:

      TITLE: ${input.title}
      DESCRIPTION: ${input.description}
      CONTENT TYPE: ${input.contentType}
      ${input.imageAnalysis ? `IMAGE ANALYSIS: ${input.imageAnalysis}` : ''}

      Requirements:
      1. Create a caption optimized for Instagram/Twitter/LinkedIn
      2. Keep it concise (under 280 characters for Twitter, slightly longer for others)
      3. Include relevant hashtags (3-5)
      4. Add a call-to-action to download the Billion app
      5. Match the tone: informative, civic-minded, but engaging
      6. For bills: emphasize impact on citizens
      7. For court cases: highlight legal significance
      8. For government orders: explain practical implications

      Format:
      - Start with an attention-grabbing hook
      - Include key information
      - End with hashtags and CTA

      Generate only the caption text.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error generating caption with Gemini:', error);
      throw error;
    }
  }

  async extractKeyPoints(fullText: string): Promise<string[]> {
    const prompt = `
      Extract 3-5 key points from the following text for social media sharing.
      Each point should be a concise sentence (under 20 words).
      Focus on the most shareable, interesting insights.

      TEXT:
      ${fullText}

      Return the key points as a numbered list, nothing else.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse numbered list
      return text
        .split('\n')
        .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(line => line.length > 0);
    } catch (error) {
      console.error('Error extracting key points with Gemini:', error);
      throw error;
    }
  }

  async generateHashtags(contentType: string, topics: string[] = []): Promise<string[]> {
    const prompt = `
      Generate 5-7 relevant hashtags for social media posts about ${contentType}.
      ${topics.length > 0 ? `Related topics: ${topics.join(', ')}` : ''}

      Requirements:
      - Mix general and specific hashtags
      - Include #BillionApp (the app name)
      - Use camel case for multi-word hashtags
      - Prioritize hashtags with good engagement for news/politics/legal content

      Return only the hashtags, separated by spaces.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Extract hashtags
      return text.match(/#[\w]+/g) || [];
    } catch (error) {
      console.error('Error generating hashtags with Gemini:', error);
      // Fallback hashtags
      const fallbackMap: Record<string, string[]> = {
        bill: ['#Legislation', '#Government', '#Politics', '#Bill', '#BillionApp'],
        court_case: ['#CourtCase', '#Justice', '#Legal', '#Law', '#BillionApp'],
        government_content: ['#Government', '#Policy', '#Order', '#ExecutiveAction', '#BillionApp'],
        general: ['#News', '#CurrentEvents', '#Politics', '#CivicTech', '#BillionApp'],
      };

      return fallbackMap[contentType] || ['#News', '#BillionApp'];
    }
  }

  async summarizeArticle(articleContent: string, maxLength: number = 200): Promise<string> {
    const prompt = `
      Summarize the following article in under ${maxLength} characters for social media.
      Focus on the key takeaways and why it matters to the public.

      ARTICLE:
      ${articleContent}

      Provide only the summary text.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error summarizing article with Gemini:', error);
      throw error;
    }
  }
}