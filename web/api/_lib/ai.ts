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
