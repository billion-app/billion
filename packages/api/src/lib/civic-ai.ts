import { GoogleGenerativeAI } from "@google/generative-ai";

function getModel() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
  });
}

export async function generateRoleDescription(
  office: string,
  role?: string,
  level?: string,
  district?: string,
): Promise<string> {
  const model = getModel();
  const prompt = `You write short civic education descriptions for a voter information app.

Describe what the following elected office does and why it matters to voters. Be factual, neutral, and specific.

Office: ${office}
${role ? `Role type: ${role}` : ""}
${level ? `Government level: ${level}` : ""}
${district ? `District: ${district}` : ""}

Rules:
- 2-3 sentences max
- Plain English, no jargon
- Focus on what this person actually does day-to-day and what power they have
- Do not include the office name in your response (the reader already sees it)
- Do not start with "This office" or "This role"

Return only the description text.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

export async function generateMeasureSummary(
  title: string,
  subtitle?: string,
  text?: string,
  proStatement?: string,
  conStatement?: string,
): Promise<string> {
  const model = getModel();
  const prompt = `You write neutral ballot measure summaries for a voter information app.

Summarize what this ballot measure does in plain language. Be factual and neutral — do not advocate for or against.

Title: ${title}
${subtitle ? `Subtitle: ${subtitle}` : ""}
${text ? `Full text (excerpt): ${text.slice(0, 1000)}` : ""}
${proStatement ? `Pro argument: ${proStatement}` : ""}
${conStatement ? `Con argument: ${conStatement}` : ""}

Rules:
- 2-3 sentences max
- Explain what changes if it passes
- Use plain English, no legal jargon
- Stay neutral — present facts, not opinions
- Do not repeat the title

Return only the summary text.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
