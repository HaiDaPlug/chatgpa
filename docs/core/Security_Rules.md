# Security Rules  Authentication, Authorization & Data Protection

**Purpose**: Non-negotiable security constraints for all ChatGPA code
**Last Updated**: November 18, 2025
**Critical**: Violations create security vulnerabilities

---

## Core Security Principles

1. **Row-Level Security (RLS) Everywhere**  All database access respects user boundaries
2. **Parent-Ownership Verification**  Child records verify parent resource ownership
3. **No Service Role in User Endpoints**  Use anon client + user tokens only
4. **Explicit Error Shapes**  Never expose internal details or stack traces
5. **Input Validation Always**  All user input validated with Zod before processing

---

## Row-Level Security (RLS)

### Rule: RLS Must Be Enabled on All Tables

Every table that stores user data **must** have RLS enabled with policies.

```sql
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_folders ENABLE ROW LEVEL SECURITY;
```

**Verification**:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- Should return 0 rows for user tables
```

---

### Rule: User Can Only Access Their Own Data

Basic RLS policy pattern for user-owned tables:

```sql
-- SELECT policy
CREATE POLICY "users_read_own" ON public.classes
  FOR SELECT USING (user_id = auth.uid());

-- INSERT policy
CREATE POLICY "users_insert_own" ON public.classes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE policy
CREATE POLICY "users_update_own" ON public.classes
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE policy
CREATE POLICY "users_delete_own" ON public.classes
  FOR DELETE USING (user_id = auth.uid());
```

---

### Rule: Parent-Ownership Verification for Child Tables

Child tables (notes, quiz_attempts, note_folders) **must** verify parent resource ownership to prevent UUID guessing attacks.

#### Problem: Basic RLS (Vulnerable)
```sql
-- L VULNERABLE: User can insert notes for ANY class UUID
CREATE POLICY "notes_insert_own" ON public.notes
  FOR INSERT WITH CHECK (user_id = auth.uid());
```

**Attack**: User guesses another user's `class_id` UUID and inserts notes into it.

#### Solution: Parent-Ownership Verification
```sql
--  SECURE: Verify class ownership before allowing note insert
CREATE POLICY "notes_insert_own" ON public.notes
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id
      AND c.user_id = auth.uid()
    )
  );
```

**Required for**:
- `notes` ’ verify `classes.user_id`
- `quiz_attempts` ’ verify `quizzes.user_id`
- `note_folders` ’ verify both `notes.user_id` AND `folders.user_id`
- `folders` ’ verify `classes.user_id` (when creating child folders, verify parent_id ownership)

---

## Authentication & Authorization

### Rule: Use Anon Client + User Tokens in API Routes

**Never** use service role keys in user-facing API endpoints.

####  Correct Pattern
```typescript
// In API route
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth token' });
  }

  const token = authHeader.replace('Bearer ', '');

  // Create anon client with user token
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,  // Anon key, NOT service role
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  // RLS automatically enforces user_id = auth.uid()
  const { data, error } = await supabase
    .from('classes')
    .select('*');

  // User automatically sees only their own classes
}
```

#### L Wrong Pattern (Security Bypass)
```typescript
// L NEVER DO THIS in user endpoints
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Bypasses RLS!
);
```

### Exception: Service Role for Webhooks Only

Service role is **only** acceptable in:
- Stripe webhook handler (`/api/stripe-webhook`)
- System-level operations (not triggered by users)

---

## Input Validation

### Rule: All User Input Must Be Validated with Zod

**Never** trust user input. Always validate before processing.

####  Correct Pattern
```typescript
import { z } from 'zod';

const GenerateQuizInput = z.object({
  class_id: z.string().uuid(),
  notes_text: z.string().min(20).max(50000),
  config: QuizConfigSchema.optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Parse and validate
  const parseResult = GenerateQuizInput.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      code: 'SCHEMA_INVALID',
      message: parseResult.error.errors[0].message
    });
  }

  const { class_id, notes_text, config } = parseResult.data;
  // Safe to use validated data
}
```

#### L Wrong Pattern (No Validation)
```typescript
// L NEVER DO THIS
const { class_id, notes_text } = req.body;  // Unvalidated!
// User could send: class_id: null, notes_text: <script>alert('XSS')</script>
```

---

## Error Handling

### Rule: All Non-200 Responses Must Follow Error Shape

**Never** expose internal errors, stack traces, or system details.

####  Correct Error Response
```typescript
// All errors use this exact shape
type ErrorResponse = {
  code: string;
  message: string;
};

// Example
return res.status(400).json({
  code: 'SCHEMA_INVALID',
  message: 'Invalid quiz configuration: total_questions must be between 5 and 20'
});
```

#### Allowed Error Codes
- `UNAUTHORIZED` (401)  Missing or invalid auth token
- `SCHEMA_INVALID` (400)  Invalid input data
- `NOT_FOUND` (404)  Resource not found
- `LIMIT_EXCEEDED` (429)  Usage limit hit
- `CIRCULAR_REFERENCE` (400)  Folder loop detected
- `OPENAI_ERROR` (500)  AI provider error
- `SERVER_ERROR` (500)  Internal server error

#### L Wrong Error Response
```typescript
// L NEVER expose internal errors
return res.status(500).json({
  error: error.stack,  // Exposes system details!
  message: error.message,  // May contain sensitive paths
  details: { supabaseKey: '...' }  // Leaks secrets!
});
```

---

## Data Protection

### Rule: No Secrets in Logs

Never log:
- Access tokens
- Service role keys
- User passwords or credentials
- Full error objects (may contain sensitive data)

####  Correct Logging
```typescript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'error',
  request_id: crypto.randomUUID(),
  user_id: userId,  // UUID is fine
  action: 'generate_quiz',
  error_code: 'OPENAI_ERROR',  // Generic code, not full error
  message: 'Quiz generation failed'  // Safe message
}));
```

#### L Wrong Logging
```typescript
// L NEVER log these
console.log({ token: req.headers.authorization });  // Leaks auth token!
console.log({ error: err });  // May contain stack trace, env vars, etc.
```

---

## Rate Limiting & Abuse Prevention

### Rule: Check Usage Limits Before Expensive Operations

Always check free tier limits **before** calling expensive APIs (OpenAI).

####  Correct Pattern
```typescript
// Check limit BEFORE making OpenAI call
const quizCount = await supabase
  .from('quizzes')
  .select('id', { count: 'exact' })
  .eq('user_id', userId);

if (quizCount.count >= 5 && userTier === 'free') {
  return res.status(429).json({
    code: 'LIMIT_EXCEEDED',
    message: 'Free tier: 5 quizzes max. Upgrade for unlimited.'
  });
}

// Now safe to generate
const quiz = await openai.chat.completions.create(...);
```

---

## Database Constraints

### Rule: Set user_id Default to auth.uid()

Prevent user_id spoofing by setting database default:

```sql
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),  -- Auto-set from JWT
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**Why**: Even if client tries to send a different `user_id`, database overwrites it with authenticated user's ID.

---

## Storage Security

### Rule: Storage Buckets Must Have RLS

Notes files are stored in `notes-files` bucket with path: `<user_id>/<file_id>`

```sql
-- Storage RLS policy
CREATE POLICY "users_access_own_files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'notes-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

**Enforcement**: Users can only access files in their own folder (`/<user_id>/`).

---

## Circular Reference Protection

### Rule: Prevent Folder Loops at Database Level

Folders can have parent folders, but must not create cycles.

```sql
CREATE OR REPLACE FUNCTION check_folder_circular_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Verify parent_id doesn't create a loop
  IF NEW.parent_id IS NOT NULL THEN
    -- Check if NEW.id appears in parent chain of NEW.parent_id
    WITH RECURSIVE parent_chain AS (
      SELECT id, parent_id FROM folders WHERE id = NEW.parent_id
      UNION ALL
      SELECT f.id, f.parent_id FROM folders f
      JOIN parent_chain pc ON f.id = pc.parent_id
    )
    SELECT 1 FROM parent_chain WHERE id = NEW.id INTO STRICT;

    IF FOUND THEN
      RAISE EXCEPTION 'Circular reference detected';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_folder_loops
  BEFORE INSERT OR UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION check_folder_circular_reference();
```

---

## Verification Checklist

Before deploying:

- [ ] RLS enabled on all user tables
- [ ] Parent-ownership policies on child tables (notes, quiz_attempts, note_folders)
- [ ] No service role keys in user-facing endpoints
- [ ] All user input validated with Zod
- [ ] All errors follow `{ code, message }` shape
- [ ] No secrets in logs
- [ ] Usage limits checked before expensive operations
- [ ] user_id defaults to `auth.uid()` in schema
- [ ] Storage buckets have RLS policies
- [ ] Circular reference prevention for folders

---

## Testing Security

### RLS Smoke Test Pattern

```typescript
// Create two users
const user1 = await supabase.auth.signUp({ email: 'user1@test.com', password: 'pass' });
const user2 = await supabase.auth.signUp({ email: 'user2@test.com', password: 'pass' });

// User 1 creates a class
const { data: class1 } = await supabase1.from('classes').insert({ name: 'CS 101' }).select().single();

// User 2 tries to read User 1's class
const { data: stolen } = await supabase2.from('classes').select('*').eq('id', class1.id);

// Verify: stolen should be null or empty array (RLS blocks)
assert(stolen === null || stolen.length === 0);
```

---

## Claude Development Constraints

When building features, Claude **must**:

1. Never disable RLS (`ALTER TABLE ... DISABLE ROW LEVEL SECURITY`)
2. Never use service role in user endpoints
3. Always validate input with Zod
4. Always return `{ code, message }` for errors
5. Never log secrets or tokens
6. Check usage limits before expensive operations
7. Verify parent ownership for child table operations
8. Use lazy initialization for Supabase clients (see ESM_Rules.md)

**Violation of these rules = security vulnerability = reject code.**

---

## Reference

- **RLS Policies**: `supabase/migrations/*.sql`
- **Parent-Ownership Examples**: See `20251110_class_workspace_folders.sql`
- **Error Codes**: See `web/api/_lib/validation.ts`
- **Zod Schemas**: See `web/api/v1/*/_schemas.ts`

---

**Last Security Audit**: November 11, 2025 (Session 14 - Folder RPC vulnerability fixed)
**Next Review**: After new feature development or schema changes
