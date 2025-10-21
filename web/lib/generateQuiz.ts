import { QuestionArray, type Question } from "./quiz-schema";

type Input = {
  className: string;
  bullets: string[];  // trimmed note summary
  keyTerms: string[]; // trimmed
  difficulty: 1|2|3|4|5;
};

export async function generateQuiz(input: Input): Promise<Question[]> {
  const res = await fetch("/api/generate-quiz", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const parsed = QuestionArray.parse(data.questions);
  // optional: ensure mcq answers are one of options
  parsed.forEach(q => {
    if (q.kind === "mcq" && !q.options.includes(q.answer)) {
      throw new Error("MCQ answer must match one of the options");
    }
  });
  return parsed;
}
