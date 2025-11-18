# 🏗️ ChatGPA Architecture — Current State

## 📐 Component Hierarchy

```
App.tsx
├── Landing.tsx (public)
└── <RequireAuth>
    ├── Dashboard.tsx
    │   ├── <PageShell>
    │   │   ├── <Sidebar>
    │   │   │   └── <Tree> (animated collapse)
    │   │   ├── <Header>
    │   │   └── <motion.div> (page transitions)
    │   │       ├── <Tabs> (Grid/List)
    │   │       ├── <Card> (for each class)
    │   │       │   ├── "Add Notes" button
    │   │       │   ├── "Generate Quiz" button → onGenerateQuiz()
    │   │       │   └── "View Progress" button
    │   │       └── <Pagination>
    │   └── <CreateClassDialog>
    ├── Results.tsx
    │   └── <PageShell>
    │       └── <Card> (for each quiz attempt)
    ├── QuizPage.tsx (existing)
    └── GeneratePage.tsx (existing)
```

## 🔄 Data Flow

### Generate Quiz Flow
```
User clicks "Generate Quiz"
    ↓
dashboard.tsx:onGenerateQuiz(classId)
    ↓
1. Show info toast: "Generating quiz…"
2. Get Supabase session
3. Fetch notes (TODO: currently mock)
    ↓
POST /api/generate-quiz
    - Headers: Bearer {access_token}
    - Body: { class_id, notes_text }
    ↓
API validates auth → checks RLS → calls OpenAI
    ↓
Quiz saved to Supabase (with RLS user_id)
    ↓
4. Show success toast: "Quiz generated."
5. TODO: navigate(`/quiz/${quiz_id}`)
```

### Search Flow
```
User types in search input
    ↓
dashboard.tsx:setQ(value)
    ↓
useQueryParam updates URL → ?q=value
    ↓
useDebounce(q, 200ms)
    ↓
qDebounced triggers useEffect
    ↓
Supabase query with .ilike filter
    ↓
Results displayed with pagination
```

### URL State Flow
```
User changes page/search
    ↓
useQueryParam hook
    ├── setValue() → updates URL
    └── popstate listener → handles back/forward
    ↓
URL params persist across refresh
```

## 🗄️ Database Schema (Current)

```sql
-- Implemented
classes (
  id uuid primary key,
  user_id uuid → auth.uid(),
  name text,
  description text,
  created_at timestamptz,
  updated_at timestamptz
)
-- RLS: user_id = auth.uid()

-- TODO: Verify exist
notes (
  id uuid primary key,
  class_id uuid → classes.id,
  user_id uuid → auth.uid(),
  content text,
  created_at timestamptz
)

quizzes (
  id uuid primary key,
  class_id uuid → classes.id,
  user_id uuid → auth.uid(),
  questions jsonb,
  created_at timestamptz
)

quiz_attempts (
  id uuid primary key,
  quiz_id uuid → quizzes.id,
  user_id uuid → auth.uid(),
  score float,
  responses jsonb,
  created_at timestamptz
)
```

## 🎨 Design Token System

```css
/* theme.css */
:root {
  /* Colors */
  --bg: #f8f9fb;
  --surface: #ffffff;
  --surface-2: #f3f4f6;
  --text: #1a1a1a;
  --text-muted: #6b7280;
  --border: rgba(0,0,0,0.08);
  --accent: #2b2b2b;       /* TODO: coral */
  --success: #2b2b2b;      /* TODO: leaf */

  /* Spacing */
  --radius: 8px;
  --shadow: 0 6px 24px rgba(0,0,0,.06);
  --space-1: 4px; --space-2: 8px; --space-3: 16px;
  --space-4: 24px; --space-5: 32px; --space-6: 40px;
}

/* Utility Classes */
.surface { background: var(--surface); }
.surface-2 { background: var(--surface-2); }
.text-muted { color: var(--text-muted); }
.bdr { border: 1px solid var(--border); }
.radius { border-radius: var(--radius); }
.btn { /* Button styles */ }
```

## 🔧 Utility Hooks

```typescript
// useDebounce.ts
const debouncedValue = useDebounce(value, 200);
// Returns value after 200ms of no changes

// useQueryParam.ts
const [q, setQ] = useQueryParam("q", "");
// Syncs state ↔ URL, handles popstate

// useQueryNumber.ts
const [page, setPage] = useQueryNumber("page", 1);
// Same as useQueryParam but for numbers

// toast.tsx
const { push } = useToast();
push({ kind: "success", text: "Done!" });
// Shows animated toast notification
```

## 🔐 Auth Flow

```
User visits protected route
    ↓
<RequireAuth> wrapper
    ↓
Check Supabase session
    ├── No session → Navigate to "/"
    └── Has session → Render children
    ↓
All API calls use Bearer token
    ↓
RLS enforces user_id = auth.uid()
```

## 📁 File Organization

```
web/src/
├── pages/
│   ├── Landing.tsx        → Public landing page
│   ├── dashboard.tsx      → Main dashboard (auth required)
│   ├── Results.tsx        → Quiz history (auth required)
│   ├── QuizPage.tsx       → Take quiz (existing)
│   └── generate.tsx       → Generate page (existing)
├── components/
│   ├── Card.tsx           → Reusable card
│   ├── Header.tsx         → Global header
│   ├── PageShell.tsx      → Layout wrapper
│   ├── Sidebar.tsx        → Navigation sidebar
│   ├── Tabs.tsx           → Tab switcher
│   ├── Pagination.tsx     → Pagination controls
│   └── CreateClassDialog.tsx → Modal
├── lib/
│   ├── auth.ts            → Auth utilities
│   ├── supabase.ts        → Supabase client
│   ├── toast.tsx          → Toast system
│   ├── telemetry.ts       → Logging
│   ├── useDebounce.ts     → Debounce hook
│   └── useQueryParam.ts   → URL state hook
├── types.ts               → TypeScript types
└── theme.css              → Design tokens
```

## 🎯 Integration Points (TODO)

### 1. Notes System
```
dashboard.tsx "Add Notes" button
    → Navigate to /classes/:id/notes
    → Fetch/save to notes table
    → Use in Generate Quiz
```

### 2. Quiz Navigation
```
After Generate Quiz success
    → navigate(`/quiz/${quiz_id}`)
    → QuizPage fetches questions
    → User submits answers
    → POST /api/grade
    → Navigate to results
```

### 3. Results Page
```
Results.tsx
    → Fetch quiz_attempts with joins
    → Display scores + dates
    → "View" → /quiz/:id/review
    → "Retake" → /quiz/:id (new attempt)
```

## 🚦 State Management

**Local State (useState)**
- Component-specific UI state
- Loading flags, modal visibility
- Form inputs

**URL State (useQueryParam)**
- Search query (?q=)
- Pagination (?page=)
- Filters, sorts

**Server State (Supabase)**
- Classes, notes, quizzes, attempts
- Fetched on mount, refetched on actions
- No global state management needed (yet)

**Auth State (Supabase)**
- Session managed by Supabase client
- Persisted in localStorage
- Auto-refreshed

## 🎨 Motion System

```typescript
// Page transitions (PageShell)
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: 6 }}
  transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
>

// Tree expand/collapse (Sidebar)
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: "auto", opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
>

// Card hover (CSS)
.card {
  transition: transform 0.16s cubic-bezier(0.2, 0, 0, 1);
}
.card:hover {
  transform: translateY(-2px);
}
```

## 📊 Performance

**Current Optimizations:**
- Debounced search (200ms)
- Abort controllers for race conditions
- Lazy state initialization
- Component code splitting (via routes)

**Future Optimizations:**
- React Query for server state caching
- Virtual scrolling for large lists
- Image lazy loading
- Bundle size analysis

---

**Last Updated:** 2025-11-03 (Session 2)
**Next Focus:** Real data integration (notes, quiz_attempts)
