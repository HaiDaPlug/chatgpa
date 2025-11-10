export type UUID = string;
export type SubscriptionStatus = "active" | "past_due" | "canceled" |
"trialing";

// Section 4: Quiz Config Types
export type QuestionType = "mcq" | "typing" | "hybrid";
export type CoverageStrategy = "key_concepts" | "broad_sample";
export type DifficultyLevel = "low" | "medium" | "high";

export interface QuestionCounts {
  mcq: number;
  typing: number;
}

export interface QuizConfig {
  question_type: QuestionType;
  question_count: number; // 1-10
  coverage: CoverageStrategy;
  difficulty: DifficultyLevel;
  question_counts?: QuestionCounts; // Required when question_type is "hybrid"
}

// Section 5: Visual & Theming Types
export type ThemeId = 'coral-leaf-dark' | 'ocean-dark';

export interface QuizVisuals {
  enabled: boolean;
  theme_id: ThemeId;
  frame_id?: string;    // From brand asset manifest
  pattern_id?: string;  // From brand asset manifest
  bannerUrl?: string;   // Optional custom banner
}

export interface QuizMetadata {
  config?: QuizConfig;   // Section 4: Quiz configuration
  visuals?: QuizVisuals; // Section 5: Visual styling
}

export interface QuestionVisual {
  kind: 'icon' | 'image' | 'sticker';
  src: string;
  alt: string; // Required for WCAG AA compliance
}