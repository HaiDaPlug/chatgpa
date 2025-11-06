// web/api/_lib/ai.ts
import OpenAI from "openai";

const DEFAULT_MODEL = "gpt-4o-mini";
let _openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_openai) return _openai;
  const raw = process.env.OPENAI_API_KEY;
  if (!raw || !raw.trim()) {
    // Throw inside handler path, not at module import
    throw new Error("OPENAI_API_KEY is missing");
  }
  _openai = new OpenAI({
    apiKey: raw.trim(),
    timeout: 60 * 1000,  // 60 second timeout
    maxRetries: 2        // Retry on transient failures
  });
  return _openai;
}

// Single source of truth for model name
export function getModel(): string {
  return (
    process.env.OPENAI_MODEL ||
    process.env.OPENAI_GEN_MODEL ||
    DEFAULT_MODEL
  );
}

export const MODEL = getModel();

// Diagnostics for visibility into AI configuration
export function aiDiagnostics() {
  const model = getModel();
  return {
    resolved_model: model,
    model_source: process.env.OPENAI_MODEL ? "OPENAI_MODEL" :
                  process.env.OPENAI_GEN_MODEL ? "OPENAI_GEN_MODEL (legacy)" :
                  `DEFAULT (${DEFAULT_MODEL})`,
    key_present: Boolean(process.env.OPENAI_API_KEY?.trim()),
    key_length: process.env.OPENAI_API_KEY?.trim().length || 0,
  };
}

// Simplified validation - let OpenAI API be source of truth for valid models
export function validateAIConfig(): { valid: boolean; error?: string } {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { valid: false, error: "OPENAI_API_KEY is missing or empty" };
  }

  // No hardcoded model list - OpenAI API will tell us if model is invalid
  return { valid: true };
}
