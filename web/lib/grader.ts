// /api/_lib/grader.ts
import { openai, MODEL } from "./ai";

export async function gradeAnswers({
  quizQuestions,
  answers
}: { quizQuestions: any[]; answers: { questionId: string; answer: string }[] }) {
  const sys = "Grade the student's answers. Return strict JSON: { score: 0-100, letter: 'F'|'D'|'C'|'B'|'A'|'A+', feedback: [{questionId, comment, correctness}] }";
  const user = JSON.stringify({ quizQuestions, answers });
  const resp = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });
  return JSON.parse(resp.choices[0]?.message?.content ?? "{}");
}
