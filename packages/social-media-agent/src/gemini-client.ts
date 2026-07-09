import type { GenerativeModel } from "@google/generative-ai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeminiOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CaptionGenerationInput {
  title: string;
  description: string;
  contentType: string;
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private options: Required<GeminiOptions>;

  constructor(apiKey: string, options: GeminiOptions = {}) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.options = {
      model: options.model ?? "gemini-2.5-flash",
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

  async generateCaption(input: CaptionGenerationInput): Promise<string> {
    const prompt = `
You write Instagram captions for Billion, a civic news app.

Write one natural caption based on:
- Title: ${input.title}
- Description: ${input.description}
- Content type: ${input.contentType}

Goals:
- Translate political, legal, and government language into plain English for a general audience.
- Explain what changed and why an ordinary person should care.
- Sound human, direct, and conversational.
- Avoid sounding like a corporate brand, LinkedIn post, Reddit comment, press release, or bot.
- No emojis.

Output rules:
- 2 short paragraphs max.
- Start with a clean hook, not clickbait.
- Keep the wording specific and easy to follow.
- Include 3-5 relevant hashtags in the caption itself at the end. Do not generate them separately.
- Include a brief Billion mention naturally if it fits, but do not force a download pitch every time.
- Stay under 500 characters.

Return only the final caption text.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error("Error generating caption with Gemini:", error);
      throw error;
    }
  }

  async extractKeyPoints(fullText: string): Promise<string[]> {
    const prompt = `
      You are a social media content creator for Billion:
      - civic tech news app
      - covers legislation, court cases, government actions in a easy-to-understand for general public
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
        .split("\n")
        .map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim())
        .filter((line) => line.length > 0);
    } catch (error) {
      console.error("Error extracting key points with Gemini:", error);
      throw error;
    }
  }

  async summarizeArticle(
    articleContent: string,
    maxLength = 200,
  ): Promise<string> {
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
      console.error("Error summarizing article with Gemini:", error);
      throw error;
    }
  }
}
