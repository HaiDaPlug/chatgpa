// Purpose: Client-side grader wrapper for QuizPage
// Connects to: /api/grade, quiz-schema

type Quiz = {
  id: string
  questions: Array<
    | { id: string; type: 'mcq'; prompt: string; options: string[]; answer: string }
    | { id: string; type: 'short'; prompt: string; answer: string }
  >
}

type GradeResult = {
  score: number
  perQuestion: Array<{
    questionId: string
    correct: boolean
    explanation: string
    feedback: string
  }>
  summary: string
}

/**
 * Remote grading via API
 * This will call /api/grade which uses the GRADER prompt
 */
export async function grade(
  quiz: Quiz,
  studentAnswers: Record<string, string | undefined>
): Promise<GradeResult> {
  const res = await fetch('/api/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      quiz: {
        questions: quiz.questions,
      },
      studentAnswers,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Grading failed: ${text}`)
  }

  const data = await res.json()
  return data
}
