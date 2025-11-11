/**
 * Section 4: Dynamic Prompt Builder
 *
 * Builds quiz generation prompts based on user configuration.
 * Adapts prompt instructions for question type, coverage, difficulty.
 */

import type { QuizConfig } from "../../shared/types.js";

interface PromptBuilderOptions {
  config: QuizConfig;
  notesText: string;
}

/**
 * Build a dynamic prompt for quiz generation based on config
 */
export function buildQuizGenerationPrompt(options: PromptBuilderOptions): string {
  const { config, notesText } = options;

  // Build question type instructions
  const typeInstructions = buildTypeInstructions(config);

  // Build coverage instructions
  const coverageInstructions = buildCoverageInstructions(config);

  // Build difficulty instructions
  const difficultyInstructions = buildDifficultyInstructions(config);

  const prompt = `You are ChatGPA's quiz generator.

Goal
- Create a concise quiz strictly from the provided NOTES.
- Return **JSON only** with this shape (no prose, no markdown):

{
  "questions": [
    {
      "id": "q1",
      "type": "mcq" | "short",
      "prompt": "string",
      "options": ["string","string","string","string"],  // mcq only
      "answer": "string"                                 // for mcq: must equal one option; for short: concise gold answer
    }
  ]
}

Constraints
- Length: Generate exactly ${config.question_count} questions.
${typeInstructions}
- MCQ: 4 plausible options; single correct answer **must** exactly match one option.
- Prompts ≤180 chars; unambiguous; no trivia.
- **Language:** write in the same language as the NOTES.
- **No outside knowledge.** Every prompt and answer must be directly supported by NOTES.

${coverageInstructions}

${difficultyInstructions}

Quality rules
- Avoid duplicates and near-duplicates.
- Prefer concept-level understanding over exact wording.
- For short answer questions: Keep answers concise (1-2 sentences or key phrase). Accept any reasonable phrasing that captures the core concept.

NOTES:
${notesText}

Now generate the quiz JSON.`;

  return prompt;
}

/**
 * Build question type-specific instructions
 */
function buildTypeInstructions(config: QuizConfig): string {
  switch (config.question_type) {
    case "mcq":
      return "- Types: Generate **only MCQ** (multiple choice) questions. No short answer questions.";

    case "typing":
      return `- Types: Generate **only short answer** questions (type: "short"). No MCQ questions.
- For typing questions: Allow students to express understanding in their own words. Questions can range from brief (1-2 sentence answers) to more detailed explanations based on the concept's complexity.`;

    case "hybrid":
      if (!config.question_counts) {
        // Fallback to balanced mix if counts not specified
        return "- Types: Generate a **balanced mix** of MCQ and short answer questions.";
      }
      return `- Types: Generate exactly ${config.question_counts.mcq} MCQ questions and ${config.question_counts.typing} short answer questions (type: "short").
- For typing questions: Allow students to express understanding in their own words. Questions can range from brief to more detailed based on complexity.`;

    default:
      return "- Types: Use a hybrid mix of MCQ and short answer questions.";
  }
}

/**
 * Build coverage strategy instructions
 */
function buildCoverageInstructions(config: QuizConfig): string {
  switch (config.coverage) {
    case "key_concepts":
      return `Coverage Strategy
- Focus on the **3-5 most important concepts** in the NOTES.
- Prioritize **depth over breadth** – it's better to thoroughly test key ideas than to superficially cover everything.
- You may **omit low-value details** (dates, minor examples, tangential points) if they don't contribute to core understanding.
- Ensure questions target fundamental understanding of the main concepts.`;

    case "broad_sample":
      return `Coverage Strategy
- **Distribute questions broadly** across all major topics and sections in the NOTES.
- Aim for **breadth first** – sample from different areas rather than deep-diving into one concept.
- Cover the full range of material provided; avoid over-focusing on a single section.
- Include questions from beginning, middle, and end of the NOTES.`;

    default:
      return `Coverage Strategy
- Cover the main sections and ideas of the NOTES.
- Balance breadth and depth appropriately.`;
  }
}

/**
 * Build difficulty-level instructions
 */
function buildDifficultyInstructions(config: QuizConfig): string {
  switch (config.difficulty) {
    case "low":
      return `Difficulty Level: Low
- Focus on **recall and recognition** – definitions, basic facts, simple identification.
- Use straightforward phrasing; avoid complex sentence structures.
- Questions should test **single-step understanding** (e.g., "What is X?", "Define Y").
- MCQ distractors should be clearly distinct from the correct answer.`;

    case "medium":
      return `Difficulty Level: Medium
- Focus on **application and explanation** – understanding how concepts work and relate.
- Include small scenarios or examples that require applying knowledge (e.g., "How would X affect Y?").
- Questions may involve **1-2 reasoning steps**.
- MCQ distractors should be plausible but distinguishable with solid understanding.`;

    case "high":
      return `Difficulty Level: High
- Focus on **synthesis and evaluation** – comparing, analyzing, solving complex problems.
- Include edge cases, exceptions, or situations requiring **multi-step reasoning**.
- Questions should test **deeper implications** and connections between concepts.
- MCQ distractors should be challenging – require careful analysis to eliminate.
- For short answers: Expect thorough explanations that demonstrate comprehensive understanding.`;

    default:
      return `Difficulty Level: Medium
- Balance recall, application, and some analysis.
- Questions should test solid understanding without being trivial.`;
  }
}
