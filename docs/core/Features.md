# ChatGPA  Feature Specifications

**Version**: 7.0
**Last Updated**: November 18, 2025
**Status**: Sections 1-7 Complete

---

## Overview

ChatGPA features are organized into **sections**, each representing a cohesive product capability. This document specifies the behavior, constraints, and implementation status of each feature.

---

## Section 1: AI Router & Generation Analytics

**Status**:  Complete (Session 7)
**Purpose**: Intelligent model selection with automatic fallback and quality tracking

### Features

#### 1.1 AI Router
- **Automatic model selection** based on task requirements
- **Dynamic parameter building**:
  - Reasoning models (gpt-5*, o-series): Omit `temperature` parameter
  - Standard models (gpt-4o*): Include `temperature` ~0.7
- **Single retry fallback**: gpt-4o-mini ’ gpt-5-mini if first call fails
- **Loud warnings**: Log failures with full context for debugging

#### 1.2 Generation Analytics
- **Quality metrics tracking**:
  - `concept_coverage` (0..1): How well questions cover note content
  - `diversity` (0..1): Variety of question types/topics
  - `duplicate_count`: Number of duplicate questions detected
- **Token usage tracking**: Prompt, completion, and total tokens
- **Latency tracking**: Time taken for generation (ms)
- **Fire-and-forget storage**: Non-blocking analytics writes

**Contract**:
```typescript
{
  event_type: 'generation_analytics',
  data: {
    quiz_id: string;
    model_used: string;
    tokens: { prompt: number; completion: number; total: number };
    latency_ms: number;
    quality_metrics: {
      concept_coverage: number;
      diversity: number;
      duplicate_count: number;
    };
  }
}
```

**Key Files**:
- `web/api/_lib/ai-router.ts`
- `web/api/v1/ai/_actions/generate.ts`

---

## Section 2: Grading Router & Rubric Engine

**Status**:  Complete (Session 8)
**Purpose**: Length-agnostic answer grading with weighted rubrics

### Features

#### 2.1 Rubric-Based Grading
- **Weighted criteria**:
  - **Coverage** (40%): How well answer addresses the question
  - **Accuracy** (35%): Factual correctness
  - **Clarity** (15%): Coherent organization
  - **Conciseness** (10%): Bonus for brevity (**never** a penalty)

- **Model selection by question type**:
  - **MCQ**: Exact string matching (no AI needed)
  - **Short answers** (< 100 chars): gpt-4o-mini, temp 0.1 (deterministic)
  - **Long answers** (e 100 chars): gpt-5-mini (reasoning model, no temp)

#### 2.2 Grading Analytics
- **Per-question metrics**: Rubric scores for each criterion
- **Token usage tracking**: Model used, tokens consumed
- **Fire-and-forget storage**: Non-blocking analytics writes

**Contract**:
```typescript
{
  event_type: 'grading_analytics',
  data: {
    attempt_id: string;
    quiz_id: string;
    model_used: string;
    rubric_scores: {
      coverage: number;   // 0..1
      accuracy: number;   // 0..1
      clarity: number;    // 0..1
      conciseness: number; // 0..1
    };
    tokens: { prompt: number; completion: number; total: number };
    latency_ms: number;
  }
}
```

**Key Innovation**: Conciseness never penalizes short answersonly rewards brevity when accuracy is maintained.

**Key Files**:
- `web/api/_lib/rubric-engine.ts`
- `web/api/_lib/grading-analytics.ts`
- `web/api/v1/ai/_actions/grade.ts`

---

## Section 3: Results Page with Autosave

**Status**:  Complete (Session 9)
**Purpose**: Real-time answer autosave with conflict resolution

### Features

#### 3.1 Autosave System
- **Incremental version tracking**: `autosave_version` increments on each save
- **Conflict resolution**: Frontend checks version before overwriting
- **Fire-and-forget**: Non-blocking autosave requests (don't wait for response)
- **Request size limit**: 500KB max to prevent abuse

#### 3.2 Results Display
- **Quiz attempt history**: All past attempts with scores
- **Per-question breakdown**: Show correct answers, user answers, and feedback
- **Score display**: 0-100% with letter grade (computed client-side)
- **Timestamp tracking**: created_at for sorting

**Autosave Flow**:
```
1. User types answer
   “
2. Debounced trigger (500ms)
   “
3. PATCH /api/v1/attempts?action=autosave
   Body: { attempt_id, responses: { q1: "answer", q2: "..." } }
   “
4. Server increments autosave_version
   “
5. Response: { ok: true, autosave_version: 2, updated_at: "..." }
   “
6. Frontend updates local version (for conflict detection)
```

**Key Files**:
- `web/api/v1/attempts/_actions/autosave.ts`
- `web/src/pages/Results.tsx`

---

## Section 4: Quiz Configuration System

**Status**:  Complete (Session 10)
**Purpose**: Customizable quiz generation with per-class defaults

### Features

#### 4.1 Question Type Configuration
- **MCQ Count**: 0-20 multiple choice questions
- **Typing Count**: 0-20 typing (short answer) questions
- **Hybrid Mode**: Mix both types in a single quiz

#### 4.2 Coverage Strategy
- **Broad**: Questions span full note content
- **Focused**: Concentrate on specific topics
- **Random**: Unpredictable question selection

#### 4.3 Difficulty Levels
- **Easy**: Basic recall questions
- **Medium**: Application and analysis
- **Hard**: Synthesis and evaluation
- **Adaptive**: Difficulty adjusts based on user history (future)

#### 4.4 Configuration Hierarchy
1. **Per-class config**: Saved to LocalStorage per `class_id`
2. **Standalone config**: Default for quizzes without class context
3. **Global default**: Hardcoded fallback

**Schema**:
```typescript
interface QuizConfig {
  question_types: {
    mcq_count: number;      // 0-20
    typing_count: number;   // 0-20
    hybrid: boolean;
  };
  coverage: 'broad' | 'focused' | 'random';
  difficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  total_questions: number;  // 5-20
}
```

**Storage**:
```typescript
// Per-class config
localStorage.setItem(`quiz_config_${classId}`, JSON.stringify(config));

// Standalone config
localStorage.setItem('quiz_config_default', JSON.stringify(config));
```

**Key Files**:
- `web/api/_lib/quiz-config-schema.ts`
- `web/api/_lib/prompt-builder.ts`
- `web/src/pages/tools/Generate.tsx`

---

## Section 5: Class Workspace with Folders

**Status**:  Complete (Sessions 12-13, all 9 phases)
**Purpose**: Hierarchical note organization with folder-based filtering

### Features

#### 5.1 Folder Management
- **Create folders**: Nested structure (unlimited depth)
- **Rename folders**: Update name (1-64 chars)
- **Move folders**: Change parent_id (with circular reference prevention)
- **Delete folders**: With cascade options:
  - `move-to-parent`: Contents move up one level
  - `move-to-uncategorized`: Remove all mappings
  - No param: Error if not empty
- **Reorder folders**: Manual sort via `sort_index`

#### 5.2 Note-Folder Mapping
- **One folder per note**: Mapping table enforces single folder
- **Drag-and-drop**: Move notes between folders
- **Uncategorized notes**: Notes without folder mapping
- **Folder filtering**: Quiz generation can filter by folder (recursive)

#### 5.3 Circular Reference Prevention
- **Database trigger**: Prevents folder loops
- **Frontend validation**: Check parent chain before move
- **Error code**: `CIRCULAR_REFERENCE` (400)

#### 5.4 Folder Navigation
- **FolderTree component**: Collapsible hierarchy
- **Breadcrumb navigation**: Show current path (avoids N+1 queries)
- **Lazy loading**: Load children on expand (optional)

**Database Schema**:
```sql
folders (
  id, user_id, class_id, parent_id, name, sort_index
)

note_folders (
  note_id, folder_id, user_id  -- denormalized for RLS
)
```

**Recursive Query (Quiz Filter)**:
```sql
-- Get all descendant folder IDs
WITH RECURSIVE descendants AS (
  SELECT id FROM folders WHERE id = $folder_id
  UNION ALL
  SELECT f.id FROM folders f
  JOIN descendants d ON f.parent_id = d.id
)
SELECT note_id FROM note_folders
WHERE folder_id IN (SELECT id FROM descendants);
```

**Key Files**:
- `web/api/v1/workspace/_actions/` (9 action files)
- `web/src/components/FolderTree.tsx`
- `supabase/migrations/20251110_class_workspace_folders.sql`

---

## Section 6b: API Gateway Consolidation

**Status**:  Complete (Session 14)
**Purpose**: Unified API structure with consistent patterns

### Features

#### 6.1 Gateway Pattern
- **Single entry point per domain**: `/api/v1/{gateway}/index.ts`
- **Action routing**: Query param `?action={action_name}`
- **Consistent middleware**: `handleGatewayRequest(req, res, actions)`
- **Underscore prefix convention**: `_actions/`, `_schemas.ts`, `_types.ts` (not routes)

#### 6.2 Gateway Structure
```
/api/v1/
   ai/           (3 actions: generate_quiz, grade, ai_health)
   attempts/     (4 actions: start, autosave, complete, update_meta)
   billing/      (2 actions: create_checkout, portal)
   marketing/    (2 actions: join_waitlist, feedback)
   util/         (4 actions: ping, health, track, use_tokens)
   workspace/    (9 actions: folder/note operations)
```

**Key Files**:
- `web/api/v1/_middleware.ts`
- `web/api/v1/_types.ts`
- All gateway `index.ts` files

---

## Section 7: Visual & Theming System

**Status**:  Complete (Session 15, all 5 phases)
**Purpose**: Brand-consistent visuals with theme tokens

### Features

#### 7.1 Design Token System
- **25 semantic tokens**: Colors, spacing, typography
- **WCAG AA compliant**: All text meets 4.5:1 contrast ratio
- **Theme presets**:
  - `coral-leaf-dark` (default): Coral accent, leaf success, dark mode
  - `ocean-dark`: Ocean blue accent, dark mode
- **CSS custom properties**: `var(--color-accent)`, `var(--spacing-md)`, etc.

#### 7.2 Asset Manifest System
- **Centralized manifest**: `brand/manifest.json`
- **Type-safe loading**: TypeScript interfaces for all assets
- **Retry logic**: 3 retries with exponential backoff
- **Graceful fallbacks**: Hide visual if asset fails to load

#### 7.3 FrameWrapper Component
- **Decorative frames**: Optional visual enhancements
- **Lazy loading**: Images loaded on demand
- **Visibility toggle**: Feature flag `VITE_FEATURE_VISUALS`
- **Accessible**: Hidden from screen readers (`aria-hidden="true"`)

#### 7.4 CI Contrast Validation
- **Automated checks**: `npm run check-contrast`
- **17 token pairs validated**: Ensures WCAG AA compliance
- **Exit code 0**: All checks pass

#### 7.5 Theme Picker (Future)
- **User-selectable themes**: Switch between presets
- **Persisted preference**: LocalStorage
- **Feature flag**: `VITE_FEATURE_THEME_PICKER`

**Design Tokens Example**:
```css
:root {
  --color-accent: hsl(350, 85%, 55%);        /* Coral */
  --color-success: hsl(145, 70%, 45%);       /* Leaf */
  --color-bg-primary: hsl(217, 33%, 7%);     /* Dark blue-black */
  --color-text-primary: hsl(210, 40%, 98%);  /* Off-white */
  --spacing-md: 1rem;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-serif: 'Georgia', serif;
}
```

**Key Files**:
- `web/src/theme-tokens.css`
- `web/src/brand/manifest.json`
- `web/src/lib/brand-assets.ts`
- `web/src/components/FrameWrapper.tsx`
- `scripts/check-contrast.ts`

---

## Feature Flags

All new features are behind environment flags for safe rollout:

```env
# Section 5: Workspace
VITE_FEATURE_WORKSPACE_FOLDERS=false  # Master toggle
VITE_FEATURE_FOLDER_DND=false         # Drag-and-drop

# Section 7: Visuals
VITE_FEATURE_VISUALS=false            # Decorative frames
VITE_FEATURE_THEME_PICKER=false       # User theme selection
```

**Rollback**: Set flag to `false` ’ Redeploy ’ Features gracefully hidden

---

## Unified Analytics (Session 8)

All events use a single `analytics` table with `event_type` discrimination:

**Event Types**:
- `generation_analytics` (Section 1)
- `grading_analytics` (Section 2)
- `results_page_view` (Section 3)
- `folder_created` (Section 5)
- `note_moved` (Section 5)
- `quiz_config_changed` (Section 4)

**Storage Pattern**:
```sql
INSERT INTO analytics (user_id, event_type, data)
VALUES (userId, 'generation_analytics', { quiz_id, model_used, ... });
```

**Fire-and-Forget**:
```typescript
// Never block user response for analytics
recordAnalytics(metrics);  // Don't await
return res.json(result);   // Return immediately
```

---

## Future Features (Planned)

### Section 6: Study Tools Sidebar
- Spaced repetition algorithm
- Flashcard mode
- Progress tracking
- Review scheduler

### Section 8: Advanced Quiz Features
- **Auto-question count**: Detect optimal quiz length from notes
- **One-question-at-a-time UI**: Modal/popup interface
- **Follow-up insights**: Post-grade revision suggestions
- **Missing material analysis**: Pre-quiz gap detection

### Performance Optimizations
- Bundle size reduction (lazy loading, code splitting)
- React Query for server state caching
- Virtual scrolling for large lists
- E2E testing (Playwright/Cypress)

---

## Reference

- **API Contracts**: [API_Reference.md](./API_Reference.md)
- **System Design**: [Architecture.md](./Architecture.md)
- **Design Tokens**: [Design_System.md](./Design_System.md)
- **Current Status**: [CURRENT_STATE.md](./CURRENT_STATE.md)

---

**Last Updated**: November 18, 2025
**Sections Complete**: 1-7 (100%)
**Next Section**: 6 (Study Tools) or 8 (Advanced Quiz Features)
