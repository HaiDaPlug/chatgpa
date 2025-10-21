import { checkQuizRelevance } from '@/lib/relevance'
import { quizSchema } from '@/lib/quiz-schema'
import { generateQuiz } from '@/lib/generateQuiz' // your existing client wrapper (server relay later)

export type GenerateParams = {
  notes: string
  mode?: 'mcq'|'short'|'hybrid'
}

export async function generateQuizFromNotes({ notes, mode = 'hybrid' }: GenerateParams) {
  // 1) Call model via your wrapper (must point to /api/generate-quiz later)
  const raw = await generateQuiz({ notes, mode })

  // 2) Validate JSON shape
  const parsed = quizSchema.parse(raw)

  // 3) Relevance gate
  const report = checkQuizRelevance({ notes, quiz: parsed })
  if (!report.ok) {
    // Optional: one retry with a stricter instruction
    const retryRaw = await generateQuiz({ notes, mode, systemHint: 'Your previous quiz was not well aligned. Use ONLY content explicitly stated in the notes. Avoid generic facts.' })
    const retryParsed = quizSchema.parse(retryRaw)
    const retryReport = checkQuizRelevance({ notes, quiz: retryParsed })

    if (!retryReport.ok) {
      return { ok: false as const, quiz: retryParsed, report: retryReport, message: 'Quiz appears off-topic. Consider refining the notes or regenerating.' }
    }
    return { ok: true as const, quiz: retryParsed, report: retryReport }
  }

  return { ok: true as const, quiz: parsed, report }
}
