# Claude Code Development Guidelines  v7

**Version**: 7.0
**Last Updated**: November 18, 2025
**Context System**: Modular documentation under `/docs/core/`

---

## Your Role

You are Claude Code, an AI coding assistant working with Hai (solo developer) on **ChatGPA**  an AI-powered study system.

**Your mission**: Build production-ready features that follow ChatGPA's architecture, security rules, and API contracts.

---

## Before Starting Any Task

1. **Read CURRENT_STATE.md** (5 min)  Know what works, what's broken, what's next
2. **Read relevant module** for your task:
   - Architecture.md for system design
   - API_Reference.md for endpoint contracts
   - Features.md for product specs
   - Security_Rules.md for constraints
   - ESM_Rules.md for backend imports
3. **Verify no conflicts** with existing code or in-progress work

---

## Core Principles

### 1. Modular Truth
- **Every concept lives in exactly ONE place**
- Never duplicate information across files
- Update the correct module, not random files
- Cross-reference liberally, copy never

### 2. Security First
- **Always follow Security_Rules.md**  non-negotiable
- RLS enforced on all database queries
- Parent-ownership verification for child tables
- No service role keys in user endpoints
- All input validated with Zod
- Error shape: `{ code, message }` only

### 3. ESM Compliance
- **Always follow ESM_Rules.md** for backend code
- All imports must use `.js` extensions
- No directory imports (use `index.js` explicitly)
- Lazy initialization for environment-dependent code
- `moduleResolution: "NodeNext"` in tsconfig

### 4. Production-Ready Always
- Build features that can ship immediately
- Feature flags for risky changes
- No mock data (wire to real Supabase)
- Clear error handling
- Proper loading states

---

## Development Workflow

### Step 1: Understand the Request
- Clarify ambiguous requirements
- Check if feature exists (read CURRENT_STATE.md)
- Identify which modules are affected
- Note any security or ESM implications

### Step 2: Plan (Use TodoWrite)
- Break task into clear steps
- Track progress with TodoWrite tool
- Mark tasks in_progress ’ completed as you work
- Keep exactly ONE task in_progress at a time

### Step 3: Implement
- Follow patterns from Architecture.md
- Respect contracts from API_Reference.md
- Apply rules from Security_Rules.md and ESM_Rules.md
- Write complete, working code (no placeholders)
- Add clear comments

### Step 4: Verify
- Check builds (no TypeScript errors)
- Verify security rules followed
- Confirm ESM imports correct
- Test error handling
- Update CURRENT_STATE.md if needed

### Step 5: Document
- Update the relevant module (not multiple files)
- Keep documentation in sync with code
- Mark features complete in CURRENT_STATE.md
- Note any known limitations

---

## Module Reference Guide

### When to Update Each Module

| Module | Update When... |
|--------|---------------|
| **CURRENT_STATE.md** | Feature complete, bug found, priorities change |
| **Architecture.md** | Database schema changes, new RLS policies, data flow changes |
| **API_Reference.md** | New endpoint, contract change, validation change |
| **Features.md** | New product feature, feature behavior change |
| **Design_System.md** | New theme tokens, visual patterns, UX guidelines |
| **Security_Rules.md** | New security constraint, RLS pattern change |
| **ESM_Rules.md** | New import pattern discovered |
| **Claude_Prompt_v7.md** | Development workflow changes |

---

## API Development Rules

### Gateway Pattern (All endpoints)

```typescript
// web/api/v1/{gateway}/index.ts
import { handleGatewayRequest } from '../_middleware.js';  //   .js required
import * as actions from './_actions/index.js';  //   .js required

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleGatewayRequest(req, res, actions);
}
```

### Action Pattern

```typescript
// web/api/v1/{gateway}/_actions/my_action.ts
import type { GatewayContext } from '../../_types.js';  //   .js required
import { MyActionInput } from '../_schemas.js';  //   .js required
import { someUtil } from '../../../_lib/util.js';  //   .js required

export async function my_action(ctx: GatewayContext) {
  // 1. Validate input
  const parseResult = MyActionInput.safeParse(ctx.body);
  if (!parseResult.success) {
    throw { code: 'SCHEMA_INVALID', message: '...', status: 400 };
  }

  // 2. Get auth
  const { userId } = ctx.auth;

  // 3. Create Supabase client with user token
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,  // Anon key, NOT service role
    { global: { headers: { Authorization: ctx.token } } }
  );

  // 4. Do work (RLS auto-enforced)
  const { data, error } = await supabase.from('classes').select('*');

  // 5. Return data
  return { data: { classes: data } };
}
```

### Schema Pattern

```typescript
// web/api/v1/{gateway}/_schemas.ts
import { z } from 'zod';

export const MyActionInput = z.object({
  class_id: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export type MyActionInput = z.infer<typeof MyActionInput>;
```

---

## Frontend Development Rules

### Component Pattern

```typescript
// Token-based styling (NOT inline hex values)
<div style={{
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)'
}}>

// Error handling
const handleSubmit = async () => {
  try {
    const res = await fetch('/api/v1/ai?action=generate_quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ class_id, notes_text })
    });

    if (!res.ok) {
      const { code, message } = await res.json();
      toast.push({ kind: 'error', text: message });
      return;
    }

    const { data } = await res.json();
    navigate(`/quiz/${data.quiz_id}`);
  } catch (err) {
    toast.push({ kind: 'error', text: 'Network error' });
  }
};
```

---

## Common Patterns

### Database Query with RLS

```typescript
// Correct: Anon client + user token (RLS enforced)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  { global: { headers: { Authorization: `Bearer ${userToken}` } } }
);

const { data } = await supabase.from('classes').select('*');
// User automatically sees only their own classes
```

### Parent-Ownership Check

```typescript
// When creating child records, verify parent ownership
const { data: parentClass } = await supabase
  .from('classes')
  .select('id')
  .eq('id', class_id)
  .eq('user_id', userId)
  .single();

if (!parentClass) {
  throw { code: 'NOT_FOUND', message: 'Class not found', status: 404 };
}

// Now safe to create note
await supabase.from('notes').insert({ class_id, content: '...' });
```

### Error Response

```typescript
// All errors use this shape
throw {
  code: 'LIMIT_EXCEEDED',
  message: 'Free tier: 5 quizzes max',
  status: 429
};

// Gateway middleware converts to JSON response
```

---

## Red Flags (Do Not Do)

L **Service role in user endpoints**
```typescript
// NEVER
const supabase = createClient(url, SUPABASE_SERVICE_ROLE_KEY);
```

L **Missing .js extensions in backend**
```typescript
// NEVER
import { foo } from './bar';  // Missing .js
```

L **Inline hex colors**
```typescript
// NEVER
<div style={{ background: '#ffffff' }}>  // Use var(--surface)
```

L **Unvalidated input**
```typescript
// NEVER
const { class_id } = req.body;  // No validation
```

L **Exposing internal errors**
```typescript
// NEVER
return res.json({ error: err.stack });  // Leaks system details
```

L **Top-level env-dependent code**
```typescript
// NEVER (crashes during cold start)
const supabase = createClient(process.env.URL!, process.env.KEY!);
// Use lazy initialization instead
```

---

## Documentation Updates

### When Feature Complete

1. Update **CURRENT_STATE.md**:
   - Move feature from "In Progress" to "Working"
   - Remove from "Known Issues" if fixing a bug
   - Update stats if applicable

2. Update relevant module:
   - **Architecture.md** if schema/RLS changed
   - **API_Reference.md** if endpoint added/changed
   - **Features.md** if product behavior changed

3. Do NOT:
   - Create new session logs (those are for historical reference)
   - Duplicate information across modules
   - Update multiple modules with same info

### When Finding Bugs

1. Add to **CURRENT_STATE.md** ’ Known Issues section
2. Include severity, impact, symptoms, suspected cause
3. Tag with priority (P0, P1, P2)

---

## Testing Checklist

Before marking task complete:

- [ ] Code builds (0 TypeScript errors)
- [ ] All imports have `.js` extensions (backend)
- [ ] All input validated with Zod
- [ ] RLS enforced (no service role in user endpoints)
- [ ] Error responses follow `{ code, message }` shape
- [ ] Token-based styling (no inline hex)
- [ ] Loading states implemented
- [ ] Error handling implemented
- [ ] CURRENT_STATE.md updated if needed
- [ ] Relevant module documentation updated

---

## Quick Reference

**Current Status**: [CURRENT_STATE.md](./CURRENT_STATE.md)
**System Design**: [Architecture.md](./Architecture.md)
**API Contracts**: [API_Reference.md](./API_Reference.md)
**Product Specs**: [Features.md](./Features.md)
**Security Rules**: [Security_Rules.md](./Security_Rules.md)  
**ESM Rules**: [ESM_Rules.md](./ESM_Rules.md)  
**Design Tokens**: [Design_System.md](./Design_System.md)

**Session History**: [/docs/archive/sessions/](../archive/sessions/)

---

## Remember

**"You are building production code for a solo developer.**
**Every line must be secure, correct, and maintainable.**
**No shortcuts. No mock data. No placeholders.**
**Follow the rules. Update the right module. Ship quality."**

---

**This prompt ensures you build ChatGPA features correctly every time.**
