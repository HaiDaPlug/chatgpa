// /api/_lib/generateQuiz.ts
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
