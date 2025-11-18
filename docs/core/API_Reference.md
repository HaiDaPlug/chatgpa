# ChatGPA  API Reference

**Version**: 7.0
**Last Updated**: November 18, 2025
**Base URL**: `/api/v1`

---

## Overview

All ChatGPA APIs follow a consistent **gateway pattern**:

```
POST /api/v1/{gateway}?action={action_name}
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
Body: { ...action-specific parameters }
```

**Response Format**:
- **Success**: `{ data: { ...results } }` (200)
- **Error**: `{ code: string, message: string }` (4xx/5xx)

---

## Authentication

All endpoints require authentication via Supabase JWT.

```typescript
const { data: { session } } = await supabase.auth.getSession();

fetch('/api/v1/ai?action=generate_quiz', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`  // Required
  },
  body: JSON.stringify({ class_id, notes_text })
});
```

**Missing/Invalid Token**: `{ code: 'UNAUTHORIZED', message: '...' }` (401)

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `SCHEMA_INVALID` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Resource not found or no access |
| `LIMIT_EXCEEDED` | 429 | Usage limit hit (free tier) |
| `CIRCULAR_REFERENCE` | 400 | Folder loop detected |
| `OPENAI_ERROR` | 500 | AI provider error |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Gateway: AI (`/api/v1/ai`)

### `generate_quiz`  Generate Quiz from Notes

**Endpoint**: `POST /api/v1/ai?action=generate_quiz`

**Request**:
```typescript
{
  class_id: string;        // UUID of class
  notes_text: string;      // 20-50,000 chars
  config?: {               // Optional quiz config (Section 4)
    question_types: {
      mcq_count: number;       // 0-20
      typing_count: number;    // 0-20
      hybrid: boolean;         // Mix both types
    };
    coverage: 'broad' | 'focused' | 'random';
    difficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
    total_questions: number;   // 5-20
  };
}
```

**Response**:
```typescript
{
  data: {
    quiz_id: string;  // UUID of generated quiz
  }
}
```

**Errors**:
- `SCHEMA_INVALID`: Invalid class_id, notes_text length, or config
- `LIMIT_EXCEEDED`: Free tier limit (5 quizzes) exceeded
- `NOT_FOUND`: Class not found or not owned by user
- `OPENAI_ERROR`: AI generation failed

**Notes**:
- Uses AI Router (Section 1): gpt-4o-mini with fallback to gpt-5-mini
- Records generation_analytics event (fire-and-forget)
- RLS enforces class ownership

---

### `grade`  Grade Quiz Attempt

**Endpoint**: `POST /api/v1/ai?action=grade`

**Request**:
```typescript
{
  quiz_id: string;  // UUID of quiz
  answers: Array<{
    questionId: string;  // e.g., "q1"
    answer: string;      // User's answer
  }>;
}
```

**Response**:
```typescript
{
  data: {
    attempt_id: string;  // UUID of created quiz_attempt
    score: number;       // 0..1 (display as 0-100%)
    feedback: Array<{
      questionId: string;
      correct: boolean;
      score: number;         // 0..1 for this question
      explanation: string;   // AI feedback
    }>;
    summary: string;  // Overall feedback
  }
}
```

**Errors**:
- `SCHEMA_INVALID`: Invalid quiz_id or answers format
- `NOT_FOUND`: Quiz not found or not owned by user
- `OPENAI_ERROR`: AI grading failed

**Notes**:
- Uses Rubric Engine (Section 2) with weighted scoring:
  - coverage: 40%
  - accuracy: 35%
  - clarity: 15%
  - conciseness: 10% (bonus only)
- Model selection:
  - MCQ/Short: gpt-4o-mini (temp 0.1)
  - Long: gpt-5-mini (reasoning, no temp)
- Records grading_analytics event
- Creates quiz_attempt record with status='completed'

---

### `ai_health`  AI System Health Check

**Endpoint**: `POST /api/v1/ai?action=ai_health`

**Request**: `{}` (empty body)

**Response**:
```typescript
{
  data: {
    status: 'healthy' | 'degraded' | 'down';
    openai_reachable: boolean;
    last_successful_generation: string;  // ISO timestamp
    last_successful_grade: string;       // ISO timestamp
  }
}
```

---

## Gateway: Attempts (`/api/v1/attempts`)

### `start`  Start New Quiz Attempt

**Endpoint**: `POST /api/v1/attempts?action=start`

**Request**:
```typescript
{
  quiz_id: string;  // UUID of quiz to attempt
}
```

**Response**:
```typescript
{
  data: {
    attempt_id: string;     // UUID of new attempt
    status: 'in_progress';
    created_at: string;     // ISO timestamp
  }
}
```

**Notes**:
- Creates quiz_attempt with status='in_progress'
- RLS enforces quiz ownership

---

### `autosave`  Autosave Responses

**Endpoint**: `PATCH /api/v1/attempts?action=autosave`

**Request**:
```typescript
{
  attempt_id: string;           // UUID of attempt
  responses: Record<string, string>;  // { questionId: answer }
}
```

**Response**:
```typescript
{
  data: {
    ok: true;
    autosave_version: number;  // Incremented for conflict resolution
    updated_at: string;        // ISO timestamp
  }
}
```

**Errors**:
- `SCHEMA_INVALID`: Request size > 500KB
- `NOT_FOUND`: Attempt not found or not owned

**Notes**:
- Section 3: Conflict resolution via autosave_version
- Fire-and-forget from frontend (non-blocking)

---

### `complete`  Mark Attempt Complete

**Endpoint**: `POST /api/v1/attempts?action=complete`

**Request**:
```typescript
{
  attempt_id: string;
}
```

**Response**:
```typescript
{
  data: {
    attempt_id: string;
    status: 'completed';
  }
}
```

---

### `update_meta`  Update Attempt Metadata

**Endpoint**: `PATCH /api/v1/attempts?action=update_meta`

**Request**:
```typescript
{
  attempt_id: string;
  meta: Record<string, any>;  // Custom metadata
}
```

**Response**:
```typescript
{
  data: {
    ok: true;
  }
}
```

---

## Gateway: Billing (`/api/v1/billing`)

### `create_checkout`  Create Stripe Checkout Session

**Endpoint**: `POST /api/v1/billing?action=create_checkout`

**Request**:
```typescript
{
  plan: 'monthly' | 'annual';
}
```

**Response**:
```typescript
{
  data: {
    checkout_url: string;  // Stripe hosted checkout URL
  }
}
```

**Notes**:
- Redirects to Stripe checkout
- Success redirects to `/dashboard?success=true`
- Cancel redirects to `/dashboard?canceled=true`

---

### `portal`  Open Stripe Customer Portal

**Endpoint**: `POST /api/v1/billing?action=portal`

**Request**: `{}` (empty body)

**Response**:
```typescript
{
  data: {
    portal_url: string;  // Stripe customer portal URL
  }
}
```

**Notes**:
- Manage subscription, payment methods, invoices

---

## Gateway: Marketing (`/api/v1/marketing`)

### `join_waitlist`  Join Product Waitlist

**Endpoint**: `POST /api/v1/marketing?action=join_waitlist`

**Request**:
```typescript
{
  email: string;           // Valid email
  feature_interest?: string;  // Optional
}
```

**Response**:
```typescript
{
  data: {
    ok: true;
  }
}
```

---

### `feedback`  Submit User Feedback

**Endpoint**: `POST /api/v1/marketing?action=feedback`

**Request**:
```typescript
{
  type: 'bug' | 'feature' | 'general';
  message: string;  // 1-5000 chars
  url?: string;     // Current page URL
}
```

**Response**:
```typescript
{
  data: {
    ok: true;
  }
}
```

---

## Gateway: Util (`/api/v1/util`)

### `ping`  Health Check

**Endpoint**: `POST /api/v1/util?action=ping`

**Request**: `{}` (empty body)

**Response**:
```typescript
{
  data: {
    pong: true;
    timestamp: string;  // ISO timestamp
  }
}
```

---

### `health`  System Health Check

**Endpoint**: `POST /api/v1/util?action=health`

**Request**: `{}` (empty body)

**Response**:
```typescript
{
  data: {
    status: 'healthy' | 'degraded';
    database: boolean;   // Supabase reachable
    storage: boolean;    // Storage reachable
    uptime: number;      // Seconds
  }
}
```

---

### `track`  Track Analytics Event

**Endpoint**: `POST /api/v1/util?action=track`

**Request**:
```typescript
{
  event: string;        // Event name
  properties?: Record<string, any>;  // Custom properties
}
```

**Response**:
```typescript
{
  data: {
    ok: true;
  }
}
```

**Notes**:
- Fire-and-forget telemetry
- Records to analytics table

---

### `use_tokens`  Track Token Usage

**Endpoint**: `POST /api/v1/util?action=use_tokens`

**Request**:
```typescript
{
  operation: 'generation' | 'grading';
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
}
```

**Response**:
```typescript
{
  data: {
    ok: true;
  }
}
```

---

## Gateway: Workspace (`/api/v1/workspace`)

Section 5: Folder workspace operations

### `folder_flat`  Get Flat Folder List

**Endpoint**: `POST /api/v1/workspace?action=folder_flat`

**Request**:
```typescript
{
  class_id: string;        // UUID of class
  include_counts?: boolean;  // Include note counts (default: false)
}
```

**Response**:
```typescript
{
  data: {
    folders: Array<{
      id: string;
      name: string;
      parent_id: string | null;
      sort_index: number;
      note_count?: number;  // Only if include_counts=true
      created_at: string;
    }>;
  }
}
```

**Notes**:
- Returns all folders in class (no nesting)
- RLS enforces class ownership

---

### `folder_tree`  Get Nested Folder Tree

**Endpoint**: `POST /api/v1/workspace?action=folder_tree`

**Request**:
```typescript
{
  class_id: string;
  parent_id?: string | null;  // Filter by parent (null = root folders)
}
```

**Response**:
```typescript
{
  data: {
    folders: Array<{
      id: string;
      name: string;
      parent_id: string | null;
      children: Array<Folder>;  // Nested structure
      note_count: number;
      created_at: string;
    }>;
  }
}
```

**Notes**:
- Recursive tree structure
- Lazy-loadable by parent_id

---

### `folder_path`  Get Breadcrumb Path

**Endpoint**: `POST /api/v1/workspace?action=folder_path`

**Request**:
```typescript
{
  folder_id: string;  // UUID of folder
}
```

**Response**:
```typescript
{
  data: {
    path: Array<{
      id: string;
      name: string;
    }>;
  }
}
```

**Notes**:
- Returns ancestors from root to folder
- Avoids N+1 queries with recursive CTE

---

### `folder_create`  Create New Folder

**Endpoint**: `POST /api/v1/workspace?action=folder_create`

**Request**:
```typescript
{
  class_id: string;
  name: string;          // 1-64 chars
  parent_id?: string;    // Optional parent folder
}
```

**Response**:
```typescript
{
  data: {
    folder: {
      id: string;
      name: string;
      parent_id: string | null;
      sort_index: number;
      created_at: string;
    };
  }
}
```

**Errors**:
- `CIRCULAR_REFERENCE`: Creating folder would cause loop
- `NOT_FOUND`: Parent folder not found or not owned

**Notes**:
- Trigger prevents circular references
- RLS enforces class ownership

---

### `folder_update`  Update Folder

**Endpoint**: `PATCH /api/v1/workspace?action=folder_update`

**Request**:
```typescript
{
  folder_id: string;
  name?: string;         // Rename (1-64 chars)
  parent_id?: string;    // Move to different parent
  sort_index?: number;   // Reorder
}
```

**Response**:
```typescript
{
  data: {
    folder: {
      id: string;
      name: string;
      parent_id: string | null;
      sort_index: number;
      updated_at: string;
    };
  }
}
```

**Errors**:
- `CIRCULAR_REFERENCE`: Moving folder would cause loop
- `CANNOT_BE_OWN_PARENT`: parent_id cannot equal folder_id

---

### `folder_delete`  Delete Folder

**Endpoint**: `DELETE /api/v1/workspace?action=folder_delete`

**Request**:
```typescript
{
  folder_id: string;
  cascade?: 'move-to-parent' | 'move-to-uncategorized';  // Optional
}
```

**Response**:
```typescript
{
  data: {
    ok: true;
    deleted_count: number;
  }
}
```

**Errors**:
- `FOLDER_NOT_EMPTY`: Folder has children/notes and no cascade specified

**Cascade Modes**:
- `move-to-parent`: Move contents up one level
- `move-to-uncategorized`: Remove all mappings (notes become uncategorized)
- No param: Error if not empty

---

### `folder_notes`  Get Notes in Folder

**Endpoint**: `POST /api/v1/workspace?action=folder_notes`

**Request**:
```typescript
{
  folder_id: string;
  limit?: number;      // 20-100 (default: 20)
  cursor?: string;     // created_at for pagination
}
```

**Response**:
```typescript
{
  data: {
    notes: Array<{
      id: string;
      title: string;
      content: string;
      created_at: string;
    }>;
    has_more: boolean;
    next_cursor: string | null;
  }
}
```

**Notes**:
- Cursor-based pagination
- Returns notes in folder (via note_folders mapping)

---

### `note_add_to_folder`  Add Note to Folder

**Endpoint**: `POST /api/v1/workspace?action=note_add_to_folder`

**Request**:
```typescript
{
  note_id: string;
  folder_id: string;
}
```

**Response**:
```typescript
{
  data: {
    ok: true;
  }
}
```

**Notes**:
- Removes old mapping if exists (1 folder per note)
- RLS verifies ownership of both note and folder

---

### `note_remove_from_folder`  Remove Note from Folder

**Endpoint**: `DELETE /api/v1/workspace?action=note_remove_from_folder`

**Request**:
```typescript
{
  note_id: string;
}
```

**Response**:
```typescript
{
  data: {
    ok: true;
  }
}
```

**Notes**:
- Note becomes uncategorized
- RLS enforces note ownership

---

### `notes_uncategorized`  Get Uncategorized Notes

**Endpoint**: `POST /api/v1/workspace?action=notes_uncategorized`

**Request**:
```typescript
{
  class_id: string;
  limit?: number;      // 20-100 (default: 20)
  cursor?: string;     // created_at for pagination
}
```

**Response**:
```typescript
{
  data: {
    notes: Array<{
      id: string;
      title: string;
      content: string;
      created_at: string;
    }>;
    has_more: boolean;
    next_cursor: string | null;
  }
}
```

**Notes**:
- Returns notes in class with no folder mapping
- Cursor-based pagination

---

## Validation Schemas

All endpoints use Zod for input validation. Schemas are defined in `web/api/v1/{gateway}/_schemas.ts`.

**Common Patterns**:

```typescript
// UUID validation
z.string().uuid()

// String length
z.string().min(1).max(100)

// Enum
z.enum(['easy', 'medium', 'hard'])

// Optional field
z.string().optional()

// Array
z.array(z.object({ ... }))

// Number range
z.number().int().min(5).max(20)
```

---

## Rate Limiting

**Current Status**: Not implemented (TODO)

**Future**: Add rate limits per endpoint:
- Quiz generation: 10 req/min
- Folder CRUD: 30 req/min
- Telemetry: 100 req/min

---

## Usage Limits (Free Tier)

Enforced before expensive operations:

```typescript
// Check limit
const { count } = await supabase
  .from('quizzes')
  .select('id', { count: 'exact' })
  .eq('user_id', userId);

if (count >= 5 && userTier === 'free') {
  throw {
    code: 'LIMIT_EXCEEDED',
    message: 'Free tier: 5 quizzes max. Upgrade for unlimited.',
    status: 429
  };
}
```

**Limits**:
- **Classes**: 1
- **Quizzes Created**: 5

**Paid Tiers**: Unlimited

---

## Reference

- **System Design**: [Architecture.md](./Architecture.md)
- **Security Rules**: [Security_Rules.md](./Security_Rules.md)
- **ESM Guidelines**: [ESM_Rules.md](./ESM_Rules.md)
- **Gateway Code**: `web/api/v1/*/index.ts`
- **Action Code**: `web/api/v1/*/_actions/*.ts`
- **Schemas**: `web/api/v1/*/_schemas.ts`

---

**Last Updated**: November 18, 2025 (Session 16 Complete)
**Total Endpoints**: 23 across 6 gateways
