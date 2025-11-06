// web/api/_lib/ai.ts
import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_openai) return _openai;
  const raw = process.env.OPENAI_API_KEY;
  if (!raw || !raw.trim()) {
    // Throw inside handler path, not at module import
    throw new Error("OPENAI_API_KEY is missing");
  }
  _openai = new OpenAI({ apiKey: raw.trim() });
  return _openai;
}

// Single source of truth for model name
export function getModel(): string {
  return (
    process.env.OPENAI_GEN_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini"
  );
}

export const MODEL = getModel();

// Validation helper for startup checks
export function validateAIConfig(): { valid: boolean; error?: string } {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { valid: false, error: "OPENAI_API_KEY is missing or empty" };
  }

  const model = getModel();
  const validModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4'];
  if (!validModels.includes(model)) {
    return { valid: false, error: `Invalid model: ${model}. Must be one of: ${validModels.join(', ')}` };
  }

  return { valid: true };
}
