// Purpose: Auto-generate title and subject for quizzes and attempts
// Connects to: generate-quiz.ts, attempts/start.ts

/**
 * Auto-generate quiz title and subject based on notes content and class metadata
 *
 * Strategy:
 * 1. Extract key concepts from notes (TF-IDF-like approach)
 * 2. Use class name as context (if available)
 * 3. Fallback to date-based naming if extraction fails
 *
 * @param notesText - Raw notes content
 * @param className - Optional class name for context
 * @param questionCount - Number of questions generated
 * @returns { title, subject }
 */
export function generateQuizMetadata(
  notesText: string,
  className?: string | null,
  questionCount?: number
): { title: string; subject: string } {
  // Stopwords for concept extraction (same pattern as rubric-engine.ts)
  const STOPWORDS = new Set([
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "can",
    "what", "which", "who", "when", "where", "why", "how",
    "of", "to", "in", "for", "on", "with", "as", "by", "from", "at",
    "this", "that", "these", "those", "it", "its", "they", "them"
  ]);

  // Subject mapping patterns (case-insensitive keywords → subject tag)
  const SUBJECT_PATTERNS: Record<string, string[]> = {
    "Biology": ["biology", "cell", "organism", "evolution", "dna", "gene", "protein", "enzyme", "photosynthesis", "ecology"],
    "Chemistry": ["chemistry", "atom", "molecule", "element", "compound", "reaction", "bond", "acid", "base", "electron"],
    "Physics": ["physics", "force", "energy", "motion", "gravity", "quantum", "velocity", "acceleration", "momentum"],
    "Mathematics": ["math", "equation", "theorem", "proof", "calculus", "algebra", "geometry", "integral", "derivative", "matrix"],
    "Computer Science": ["computer", "algorithm", "data structure", "programming", "software", "code", "function", "class", "variable", "array"],
    "History": ["history", "war", "revolution", "empire", "civilization", "ancient", "medieval", "century", "dynasty"],
    "Economics": ["economics", "market", "supply", "demand", "trade", "inflation", "gdp", "fiscal", "monetary"],
    "Psychology": ["psychology", "behavior", "cognitive", "brain", "memory", "perception", "emotion", "consciousness"],
    "English": ["literature", "novel", "poetry", "grammar", "writing", "essay", "author", "shakespeare", "rhetoric"],
    "Philosophy": ["philosophy", "ethics", "logic", "metaphysics", "epistemology", "kant", "plato", "aristotle"],
  };

  try {
    // Normalize and extract words
    const normalized = notesText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const words = normalized
      .split(" ")
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));

    // Count word frequencies
    const wordFreq: Record<string, number> = {};
    words.forEach((word) => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    // Get top 3 most frequent words (concept extraction)
    const topConcepts = Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([word]) => word);

    // Detect subject based on keyword patterns
    let detectedSubject = "General";
    let maxMatches = 0;

    for (const [subject, keywords] of Object.entries(SUBJECT_PATTERNS)) {
      const matches = keywords.filter((kw) =>
        normalized.includes(kw.toLowerCase())
      ).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        detectedSubject = subject;
      }
    }

    // If class name contains subject hint, use it
    if (className) {
      const classLower = className.toLowerCase();
      for (const [subject, keywords] of Object.entries(SUBJECT_PATTERNS)) {
        if (keywords.some((kw) => classLower.includes(kw.toLowerCase()))) {
          detectedSubject = subject;
          break;
        }
      }
    }

    // Generate title
    let title: string;

    if (topConcepts.length > 0 && className) {
      // Best case: class name + top concept
      const concept = capitalize(topConcepts[0]);
      title = `${className} — ${concept}`;
    } else if (topConcepts.length > 0) {
      // No class: use top 2 concepts
      const concepts = topConcepts.slice(0, 2).map(capitalize).join(" & ");
      title = `${detectedSubject}: ${concepts}`;
    } else if (className) {
      // Fallback: class name + date
      const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
      title = `${className} Quiz — ${date}`;
    } else {
      // Last resort: subject + date
      const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
      title = `${detectedSubject} Quiz — ${date}`;
    }

    // Add question count if provided (optional enhancement)
    if (questionCount) {
      title += ` (${questionCount}Q)`;
    }

    return {
      title: title.slice(0, 100), // Cap at 100 chars
      subject: detectedSubject,
    };

  } catch (error) {
    // Fallback on any error: safe default
    const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const fallbackTitle = className ? `${className} Quiz — ${date}` : `Quiz — ${date}`;

    return {
      title: fallbackTitle,
      subject: "General",
    };
  }
}

/**
 * Capitalize first letter of a word
 */
function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Extract subject from notes content only (no class context)
 * Used for retroactive subject detection on existing quizzes
 */
export function detectSubject(notesText: string): string {
  const { subject } = generateQuizMetadata(notesText);
  return subject;
}

/**
 * Generate title from question list (for attempts without notes context)
 * Uses first question prompt as basis
 */
export function generateTitleFromQuestions(
  questions: Array<{ prompt: string }>,
  subject?: string
): string {
  if (questions.length === 0) {
    const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `Quiz — ${date}`;
  }

  // Extract first meaningful words from first question
  const firstPrompt = questions[0].prompt;
  const words = firstPrompt
    .split(/\s+/)
    .slice(0, 4) // Take first 4 words
    .join(" ");

  const prefix = subject ? `${subject}: ` : "";
  const title = `${prefix}${words}...`;

  return title.slice(0, 100); // Cap at 100 chars
}
