// /web/src/lib/providers.ts
export type Msg = { role: "user" | "assistant" | "system"; content: string };

export interface LLMProvider {
  chat(messages: Msg[], userId?: string): Promise<{ text: string; tokens: number }>;
  vision?(prompt: string, imageUrl?: string, userId?: string): Promise<{ text: string; tokens: number }>;
}
