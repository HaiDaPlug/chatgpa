/**
 * LLM Provider Adapter
 *
 * Abstraction layer for swappable LLM providers (Claude, OpenAI, etc.)
 * All AI calls should go through this adapter to keep provider swappable.
 *
 * Usage:
 *   import { llm } from '@/lib/llm/adapter'
 *   const summary = await llm.summarize(noteContent)
 */

import Anthropic from '@anthropic-ai/sdk'

// ===========================================
// TYPES
// ===========================================

export interface Question {
  id: string
  question: string
  type: 'multiple_choice' | 'short_answer' | 'true_false'
  options?: string[]           // For multiple choice
  correct_answer: string
}

export interface GradingResult {
  question_id: string
  correct: boolean
  concept_understood: string   // Explanation of what they got right
  terminology_precision: string // Assessment of technical vocabulary
  feedback: string             // Formatted feedback with ✅ ⚠️ 💡 emojis
}

export interface LLMProvider {
  /**
   * Generate a concise, scannable summary from note content
   */
  summarize(content: string, context?: string): Promise<string>

  /**
   * Generate quiz questions from note content
   */
  generateQuiz(content: string, numQuestions: number, difficulty?: 'easy' | 'medium' | 'hard'): Promise<Question[]>

  /**
   * Grade a user's answer with adaptive feedback (THE DIFFERENTIATOR)
   */
  grade(question: Question, userAnswer: string, correctAnswer: string): Promise<GradingResult>
}

// ===========================================
// ANTHROPIC (CLAUDE) PROVIDER
// ===========================================

class AnthropicProvider implements LLMProvider {
  private client: Anthropic

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required')
    }

    this.client = new Anthropic({ apiKey })
  }

  async summarize(content: string, context?: string): Promise<string> {
    const prompt = `You are an expert educator helping students prepare for exams.

Summarize the following notes into clear, scannable bullet points that highlight:
- Key concepts and definitions
- Important processes or sequences
- Common misconceptions to avoid
- Terms students need to memorize

${context ? `Context: This is from a ${context} class.\n\n` : ''}Notes:
${content}

Format your summary using markdown with clear headings and bullet points.`

    const response = await this.client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const textContent = response.content.find(c => c.type === 'text')
    return textContent?.type === 'text' ? textContent.text : ''
  }

  async generateQuiz(
    content: string,
    numQuestions: number = 5,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ): Promise<Question[]> {
    const prompt = `You are an expert educator creating exam-style quiz questions.

Generate ${numQuestions} ${difficulty} difficulty questions from these notes.

Mix of question types:
- 60% multiple choice (4 options each)
- 30% short answer
- 10% true/false

Requirements:
- Questions should test understanding, not just memorization
- Multiple choice options should be plausible but clearly distinguishable
- Short answer questions should have clear, specific answers
- Avoid trick questions

Notes:
${content}

Return ONLY a JSON array of questions in this exact format:
[
  {
    "id": "q1",
    "question": "What is mitosis?",
    "type": "multiple_choice",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Option B"
  },
  {
    "id": "q2",
    "question": "Explain the role of the centromere",
    "type": "short_answer",
    "correct_answer": "The centromere is the region where sister chromatids are joined and where spindle fibers attach during cell division"
  }
]`

    const response = await this.client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (textContent?.type !== 'text') {
      throw new Error('Failed to generate quiz: no text response')
    }

    // Extract JSON from response (Claude sometimes adds markdown code blocks)
    let jsonText = textContent.text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '').trim()
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/```\n?$/, '').trim()
    }

    const questions: Question[] = JSON.parse(jsonText)
    return questions
  }

  async grade(
    question: Question,
    userAnswer: string,
    correctAnswer: string
  ): Promise<GradingResult> {
    const prompt = `You are an expert educator grading a student's answer.

Question: ${question.question}
Question Type: ${question.type}
${question.options ? `Options: ${question.options.join(', ')}` : ''}
Correct Answer: ${correctAnswer}
Student's Answer: ${userAnswer}

Evaluate the student's answer and provide feedback in this format:

1. **Correctness**: Is the answer correct? (yes/no)
2. **Concept Understanding**: What core concept did they understand or miss?
3. **Terminology Precision**: How precise was their use of technical vocabulary?
4. **Feedback**: Encouraging, educational feedback formatted with:
   - ✅ What they got RIGHT (even if partially)
   - ⚠️ What needs REFINEMENT (terminology, precision, etc.)
   - 💡 Actionable advice on what to remember

Be encouraging but precise. If they're wrong, explain WHY and what to focus on.
If they're right, acknowledge it and suggest how to make their answer even stronger.

Return ONLY a JSON object in this exact format:
{
  "correct": true/false,
  "concept_understood": "Brief explanation of concept understanding",
  "terminology_precision": "Assessment of technical vocabulary",
  "feedback": "✅ Formatted feedback with emojis..."
}`

    const response = await this.client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (textContent?.type !== 'text') {
      throw new Error('Failed to grade answer: no text response')
    }

    // Extract JSON from response
    let jsonText = textContent.text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '').trim()
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/```\n?$/, '').trim()
    }

    const result = JSON.parse(jsonText)
    return {
      question_id: question.id,
      ...result
    }
  }
}

// ===========================================
// OPENAI PROVIDER (Future implementation)
// ===========================================

// class OpenAIProvider implements LLMProvider {
//   async summarize(content: string): Promise<string> {
//     // OpenAI implementation
//   }
//
//   async generateQuiz(content: string, numQuestions: number): Promise<Question[]> {
//     // OpenAI implementation
//   }
//
//   async grade(question: Question, userAnswer: string): Promise<GradingResult> {
//     // OpenAI implementation
//   }
// }

// ===========================================
// EXPORT SINGLETON
// ===========================================

// Default to Anthropic (Claude)
export const llm: LLMProvider = new AnthropicProvider()

// To swap providers, just change this line:
// export const llm: LLMProvider = new OpenAIProvider()
