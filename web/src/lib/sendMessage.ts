export type Msg = { role: "user" | "assistant" | "system"; content: string };

export async function sendText(messages: Msg[], user_id?: string) {
  const r = await fetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, user_id }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.error || `chat_failed_${r.status}`);
  return j as { reply: string; usage: { total_tokens: number } };
}

export async function analyzeImage(prompt: string, imageUrl?: string, imageBase64?: string, user_id?: string) {
  const r = await fetch("/api/vision", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, imageUrl, imageBase64, user_id }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.error || `vision_failed_${r.status}`);
  return j as { answer: string; usage: { total_tokens: number } };
}
