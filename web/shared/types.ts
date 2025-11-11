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

// Section 5: Class Workspace - Folder Types
export interface Folder {
  id: string;
  user_id: string;
  class_id: string;
  parent_id: string | null;
  name: string;
  sort_index: number;
  created_at: string;
  updated_at: string;

  // Computed fields (API-only)
  children?: Folder[];      // For tree endpoint
  note_count?: number;      // For include_counts=true
}

export interface NoteFolder {
  note_id: string;
  folder_id: string;
  user_id: string;
  created_at: string;
}

export interface BreadcrumbSegment {
  id: string;
  name: string;
  type: 'class' | 'folder';
}

// Enhanced Note type with folder information
export interface Note {
  id: string;
  user_id: string;
  class_id: string;
  title: string | null;
  source_type: 'text' | 'pdf' | 'docx' | 'image';
  path: string | null;
  content: string;
  created_at: string;

  // Computed fields (join with note_folders)
  folder_id?: string;
  folder_name?: string;
}