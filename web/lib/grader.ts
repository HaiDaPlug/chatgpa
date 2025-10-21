import { GradeResult, type Question } from "./quiz-schema";

type GradeInput = {
  className: string;
  bullets: string[];
  keyTerms: string[];
  questions: Question[];
  answers: Record<string, string>;
};

export async function gradeAttempt(input: GradeInput) {
  const res = await fetch("/api/grade", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const safe = GradeResult.parse(data);
  return {
    ...safe,
    score: Math.round(
      (safe.perQuestion.reduce((s, q) => s + q.score, 0) / safe.perQuestion.length) * 100
    ) / 100,
  };
}
