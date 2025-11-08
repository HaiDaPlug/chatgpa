// Purpose: Length-agnostic rubric engine for grading with concept extraction
// Connects to: grade.ts, grading-analytics.ts

// ============================================================================
// Constants
// ============================================================================

export const RUBRIC_VERSION = "v1.0";

// Rubric weights (must sum to 1.0)
export const RUBRIC_WEIGHTS = {
  coverage: 0.4, // Concept coverage - did they hit must-know points?
  accuracy: 0.35, // Factual correctness and relationships
  clarity: 0.15, // Coherent, organized, appropriate terminology
  conciseness: 0.1, // Bonus if complete AND succinct
} as const;

// Stopwords for concept extraction (reuse from analytics-service.ts pattern)
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "what",
  "which",
  "who",
  "when",
  "where",
  "why",
  "how",
  "of",
  "to",
  "in",
  "for",
  "on",
  "with",
  "as",
  "by",
  "from",
  "at",
  "this",
  "that",
  "these",
  "those",
]);

// ============================================================================
// Types
// ============================================================================

export interface CriteriaScores {
  coverage: number; // 0-2
  accuracy: number; // 0-2
  clarity: number; // 0-2
  conciseness: number; // 0-2
}

export interface ConceptHit {
  concept: string;
  hit: boolean;
}

export interface RubricResult {
  score: number; // 0-1 (weighted total)
  criteria: CriteriaScores;
  concept_hits: ConceptHit[];
  feedback: string;
  improvement: string;
}

// ============================================================================
// Concept Extraction
// ============================================================================

/**
 * Extract key concepts from text.
 * Simple heuristic: lowercase, remove punctuation, split into words, filter stopwords.
 */
function extractConcepts(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w));

  return new Set(words);
}

/**
 * Extract expected concepts from question prompt and reference answer.
 * These are the "must-know" concepts the student should address.
 */
export function extractExpectedConcepts(prompt: string, referenceAnswer?: string): string[] {
  const promptConcepts = extractConcepts(prompt);
  const referenceConcepts = referenceAnswer ? extractConcepts(referenceAnswer) : new Set<string>();

  // Combine unique concepts from both
  const allConcepts = new Set<string>([
    ...Array.from(promptConcepts),
    ...Array.from(referenceConcepts)
  ]);

  return Array.from(allConcepts);
}

/**
 * Check which expected concepts appear in student answer.
 */
export function checkConceptHits(
  expectedConcepts: string[],
  studentAnswer: string
): ConceptHit[] {
  const studentConcepts = extractConcepts(studentAnswer);

  return expectedConcepts.map((concept) => ({
    concept,
    hit: studentConcepts.has(concept),
  }));
}

// ============================================================================
// Scoring
// ============================================================================

/**
 * Calculate weighted rubric score from criteria scores.
 * Each criterion is 0-2, weighted by RUBRIC_WEIGHTS.
 * Returns 0-1 score.
 */
export function calculateRubricScore(criteria: CriteriaScores): number {
  const maxPerCriterion = 2;

  const normalizedScores = {
    coverage: criteria.coverage / maxPerCriterion,
    accuracy: criteria.accuracy / maxPerCriterion,
    clarity: criteria.clarity / maxPerCriterion,
    conciseness: criteria.conciseness / maxPerCriterion,
  };

  const weightedScore =
    normalizedScores.coverage * RUBRIC_WEIGHTS.coverage +
    normalizedScores.accuracy * RUBRIC_WEIGHTS.accuracy +
    normalizedScores.clarity * RUBRIC_WEIGHTS.clarity +
    normalizedScores.conciseness * RUBRIC_WEIGHTS.conciseness;

  return Math.round(weightedScore * 100) / 100; // Round to 2 decimals
}

// ============================================================================
// Feedback Generation
// ============================================================================

/**
 * Generate actionable feedback based on rubric scores and concept hits.
 * Format: "You covered X/Y key concepts. To reach full credit, add: [bullets]"
 */
export function generateActionableFeedback(
  criteria: CriteriaScores,
  conceptHits: ConceptHit[]
): { feedback: string; improvement: string } {
  const hitCount = conceptHits.filter((c) => c.hit).length;
  const totalConcepts = conceptHits.length;
  const missedConcepts = conceptHits.filter((c) => !c.hit).map((c) => c.concept);

  // Build feedback message
  let feedback = `You covered ${hitCount}/${totalConcepts} key concepts. `;

  // Strengths
  const strengths: string[] = [];
  if (criteria.coverage >= 1.5) strengths.push("strong concept coverage");
  if (criteria.accuracy >= 1.5) strengths.push("factually accurate");
  if (criteria.clarity >= 1.5) strengths.push("clear and organized");
  if (criteria.conciseness >= 1.5) strengths.push("concise");

  if (strengths.length > 0) {
    feedback += `Strengths: ${strengths.join(", ")}. `;
  }

  // Gaps
  const gaps: string[] = [];
  if (criteria.coverage < 1.5) gaps.push("concept coverage");
  if (criteria.accuracy < 1.5) gaps.push("factual accuracy");
  if (criteria.clarity < 1.5) gaps.push("clarity and organization");

  if (gaps.length > 0) {
    feedback += `Areas to improve: ${gaps.join(", ")}.`;
  } else {
    feedback += "Excellent work overall!";
  }

  // Build improvement suggestion
  let improvement = "";
  if (missedConcepts.length > 0) {
    const missedList = missedConcepts.slice(0, 3).join(", "); // Show max 3
    improvement = `To reach full credit, add these missing concepts: ${missedList}`;
    if (missedConcepts.length > 3) {
      improvement += ` (and ${missedConcepts.length - 3} more)`;
    }
    improvement += ".";
  } else {
    improvement = "You've covered all key concepts. Focus on refining clarity and precision.";
  }

  return { feedback, improvement };
}

/**
 * Calculate concept coverage ratio (0-1).
 * Used for analytics: total_concepts_hit / total_concepts_detected.
 */
export function calculateConceptCoverageRatio(conceptHits: ConceptHit[]): number {
  if (conceptHits.length === 0) return 0;

  const hitCount = conceptHits.filter((c) => c.hit).length;
  return Math.round((hitCount / conceptHits.length) * 100) / 100;
}

// ============================================================================
// Full Rubric Evaluation
// ============================================================================

/**
 * Apply rubric to student answer.
 * This is a simplified version - in production, the AI provides criteria scores.
 * This function is used for fallback/deterministic grading when AI is unavailable.
 */
export function applyRubric(
  prompt: string,
  studentAnswer: string,
  referenceAnswer?: string
): RubricResult {
  // Extract expected concepts
  const expectedConcepts = extractExpectedConcepts(prompt, referenceAnswer);

  // Check concept hits
  const conceptHits = checkConceptHits(expectedConcepts, studentAnswer);

  // Simplified heuristic scoring (when AI isn't available)
  const coverageRatio = calculateConceptCoverageRatio(conceptHits);

  const criteria: CriteriaScores = {
    coverage: Math.min(2, Math.round(coverageRatio * 2 * 10) / 10), // 0-2 based on coverage
    accuracy: 1, // Neutral - requires semantic understanding
    clarity: studentAnswer.length >= 20 ? 1.5 : 1, // Basic length heuristic
    conciseness: studentAnswer.length <= 200 ? 2 : 1, // Reward brevity
  };

  const score = calculateRubricScore(criteria);
  const { feedback, improvement } = generateActionableFeedback(criteria, conceptHits);

  return {
    score,
    criteria,
    concept_hits: conceptHits,
    feedback,
    improvement,
  };
}

/**
 * Parse AI-generated rubric response and validate.
 * Expected AI response format:
 * {
 *   coverage: 0-2,
 *   accuracy: 0-2,
 *   clarity: 0-2,
 *   conciseness: 0-2
 * }
 */
export function parseAIRubricResponse(
  aiResponse: any,
  conceptHits: ConceptHit[]
): RubricResult {
  // Validate and extract criteria scores
  const criteria: CriteriaScores = {
    coverage: Math.min(2, Math.max(0, Number(aiResponse.coverage) || 0)),
    accuracy: Math.min(2, Math.max(0, Number(aiResponse.accuracy) || 0)),
    clarity: Math.min(2, Math.max(0, Number(aiResponse.clarity) || 0)),
    conciseness: Math.min(2, Math.max(0, Number(aiResponse.conciseness) || 0)),
  };

  const score = calculateRubricScore(criteria);
  const { feedback, improvement } = generateActionableFeedback(criteria, conceptHits);

  return {
    score,
    criteria,
    concept_hits: conceptHits,
    feedback,
    improvement,
  };
}
