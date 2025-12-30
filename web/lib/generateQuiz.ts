// ⚠️ DEPRECATED: This is a legacy file. Production code should use:
//    - web/api/v1/ai/_actions/generate.ts (server-side generation with proper model parameter handling)
//    - If you need to add OpenAI parameters like max_tokens/max_completion_tokens,
//      import helpers from web/api/_lib/ai-router.ts (detectModelFamily, buildOpenAIParams)

import { openai, MODEL } from "./ai";
import { quizSchema } from "@/web/src/lib/quiz-schema";

export async function generateQuiz({ notesText }: { notesText: string }) {
  const sys = "You generate quizzes as strict JSON matching the provided schema. No extra text.";
  const user = `Notes:\n${notesText}\n\nReturn JSON only.`;
  const resp = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });
  const raw = resp.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  const safe = quizSchema.safeParse(parsed);
  if (!safe.success) throw new Error("Schema mismatch");
  return safe.data;
}
