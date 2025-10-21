# ChatGPA API Routes

All API routes are Vercel serverless functions in `web/api/`.

## Authentication

All routes except `/api/ping` require authentication via Supabase JWT token in the `Authorization` header.

```typescript
headers: {
  'Authorization': `Bearer ${supabaseToken}`
}
```

## Core ChatGPA Routes

### 1. `/api/summarize` (POST)
Generate AI summary from uploaded notes.

**Request:**
```json
{
  "content": "Raw text from notes...",
  "class_name": "Biology 101" // optional context
}
```

**Response:**
```json
{
  "success": true,
  "summary": "## Key Concepts\n- Concept 1\n- Concept 2...",
  "token_usage": {
    "input": 1234,
    "output": 567
  }
}
```

**Implementation:**
```typescript
// Uses Claude 3.5 Sonnet
// Prompt: "Summarize these notes into scannable bullet points..."
// Returns markdown-formatted summary
```

---

### 2. `/api/generate-quiz` (POST)
Generate quiz questions from notes or summary.

**Request:**
```json
{
  "class_id": "uuid",
  "note_id": "uuid", // optional
  "content": "Note content or summary...",
  "num_questions": 5, // default 5-10
  "difficulty": "medium" // easy, medium, hard
}
```

**Response:**
```json
{
  "success": true,
  "quiz_id": "uuid",
  "questions": [
    {
      "id": "q1",
      "question": "What is mitosis?",
      "type": "multiple_choice",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "B" // only stored, not returned to client
    },
    {
      "id": "q2",
      "question": "Explain the role of the centromere",
      "type": "short_answer"
    }
  ]
}
```

**Implementation:**
```typescript
// Uses Claude 3.5 Sonnet
// Prompt: "Generate 5 exam-style questions (mix of MC and short answer)..."
// Stores quiz in database
// Returns questions WITHOUT correct answers to client
```

---

### 3. `/api/grade` (POST)
**THE DIFFERENTIATOR** - Adaptive AI grading with explanatory feedback.

**Request:**
```json
{
  "quiz_id": "uuid",
  "answers": [
    {
      "question_id": "q1",
      "user_answer": "B"
    },
    {
      "question_id": "q2",
      "user_answer": "The centromere holds the chromatids together"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "attempt_id": "uuid",
  "score": 85.5,
  "results": [
    {
      "question_id": "q1",
      "correct": true,
      "concept_understood": "Perfect understanding",
      "terminology_precision": "Excellent",
      "feedback": "✅ Correct! You nailed this one."
    },
    {
      "question_id": "q2",
      "correct": true,
      "concept_understood": "You understand the centromere's role in holding sister chromatids",
      "terminology_precision": "Good concept, could be more precise",
      "feedback": "✅ Concept correct: You understand that the centromere connects chromatids.\n⚠️ Terminology precision: Use 'sister chromatids' instead of just 'chromatids'.\n💡 What to remember: You've got the WHAT (connecting structure), tighten the terminology (sister chromatids)."
    }
  ]
}
```

**Implementation:**
```typescript
// Uses Claude 3.5 Sonnet with special grading prompt
// Fetches correct answers from database
// For each question:
//   - Compare user answer to correct answer
//   - Identify concept understanding vs terminology precision
//   - Generate encouraging, educational feedback
// This is ChatGPA's moat - competitors just say "right/wrong"
```

**Grading Prompt Structure:**
```
You are an expert educator grading student answers. For each answer:

1. Determine if the core CONCEPT is understood (yes/no)
2. Assess TERMINOLOGY precision (perfect/good/needs work)
3. Provide feedback in this format:
   - ✅ What they got RIGHT
   - ⚠️ What needs REFINEMENT
   - 💡 Actionable advice

Be encouraging but precise. Don't just say "wrong" - explain WHY.
```

---

### 4. `/api/upload-note` (POST)
Handle file upload (PDF, DOCX, TXT) and text extraction.

**Request:**
```typescript
// FormData with file upload
const formData = new FormData();
formData.append('file', fileBlob);
formData.append('class_id', classId);
formData.append('title', 'Chapter 5 Notes');
```

**Response:**
```json
{
  "success": true,
  "note_id": "uuid",
  "extracted_text": "Content from PDF/DOCX...",
  "file_url": "https://supabase.co/storage/notes/user-id/file.pdf"
}
```

**Implementation:**
```typescript
// 1. Upload file to Supabase Storage (bucket: 'notes')
// 2. Extract text:
//    - PDF: pdf-parse or pdf.js
//    - DOCX: mammoth.js
//    - TXT: direct read
// 3. Store note in database with extracted text + file URL
// 4. Return note_id for quiz generation
```

---

## Reused Carpool Routes (Modified)

### 5. `/api/router` (POST/GET)
Main action router - handles multiple actions via `?action=` query param.

**Existing actions to keep:**
- `stripe-checkout` - Create Stripe checkout session
- `verify-payment` - Check payment status

**New ChatGPA actions:**
- `get-classes` - Fetch user's classes
- `create-class` - Create new class (with free tier limit check)
- `get-quizzes` - Fetch quizzes for a class
- `check-limits` - Check if user can create class or take quiz (free tier)

**Example:**
```typescript
// GET /api/router?action=get-classes
{
  "success": true,
  "classes": [
    { "id": "uuid", "name": "Biology 101", "quiz_count": 3 }
  ]
}

// POST /api/router?action=create-class
{
  "name": "Chemistry 202",
  "description": "Organic Chemistry"
}
```

---

### 6. `/api/stripe-webhook` (POST)
Handle Stripe webhook events (subscription created, renewed, canceled).

**Keep existing logic, update for new tiers:**
- `cram` - One-time payment, set expiration date (7 days)
- `monthly` - Recurring, update subscription status
- `annual` - Recurring, update subscription status

**Events to handle:**
- `checkout.session.completed` - Grant access
- `customer.subscription.updated` - Update tier/status
- `customer.subscription.deleted` - Mark as canceled
- `invoice.payment_succeeded` - Renew subscription
- `invoice.payment_failed` - Mark as past_due

---

## Usage Limits & Free Tier

### Check if user can take action:
```typescript
// Before creating class
const canCreate = await supabase.rpc('can_create_class', {
  p_user_id: userId
});

// Before starting quiz
const canTake = await supabase.rpc('can_take_quiz', {
  p_user_id: userId
});
```

### Increment counters:
```typescript
// After creating class
await supabase.rpc('increment_class_count', { p_user_id: userId });

// After completing quiz
await supabase.rpc('increment_quiz_count', { p_user_id: userId });
```

---

## Error Handling

All routes return consistent error format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE" // optional
}
```

**Common error codes:**
- `AUTH_REQUIRED` - Missing/invalid token
- `LIMIT_REACHED` - Free tier limit hit
- `INVALID_INPUT` - Bad request data
- `PAYMENT_REQUIRED` - Feature requires paid tier
- `RATE_LIMIT` - Too many requests
- `AI_ERROR` - Claude API error

---

## Rate Limiting

**Free tier:**
- 5 quizzes total (lifetime until upgrade)
- 1 class max

**Paid tiers:**
- No hard limits
- Soft rate limit: 100 API calls/minute (prevents abuse)

---

## File Upload Limits

**File size:**
- Free tier: 5MB per file
- Paid tiers: 25MB per file

**Supported formats:**
- `.txt`
- `.pdf`
- `.docx`

**Storage:**
- Supabase Storage bucket: `notes`
- Path structure: `{user_id}/{note_id}.{ext}`
- RLS policies: user can only access their own files

---

## Development Checklist

### Phase 1: Core Routes
- [ ] `/api/summarize` - Basic Claude integration
- [ ] `/api/generate-quiz` - Quiz generation
- [ ] `/api/grade` - Adaptive grading (THE MOAT)

### Phase 2: File Upload
- [ ] `/api/upload-note` - Text extraction from PDF/DOCX
- [ ] Supabase Storage setup + RLS policies

### Phase 3: Dashboard Routes
- [ ] Update `/api/router` with ChatGPA actions
- [ ] Usage limit checks (RPCs)
- [ ] Class/quiz CRUD operations

### Phase 4: Payment
- [ ] Update Stripe checkout for new tiers
- [ ] Webhook handling for subscriptions
- [ ] Free tier enforcement

---

## Testing Strategy

### Unit Tests
- Test Claude API prompts with various note content
- Test grading logic with edge cases (empty answers, etc.)
- Test file extraction (PDF, DOCX edge cases)

### Integration Tests
- Test full flow: upload → summarize → quiz → grade
- Test free tier limits enforcement
- Test Stripe webhook handling

### Manual Testing
- Upload real textbook notes
- Generate quizzes and verify quality
- Test adaptive grading feedback quality
- Ensure grading is encouraging but accurate

---

## Performance Considerations

**Claude API:**
- Cache summaries (same content = same summary)
- Stream quiz generation for faster UX
- Parallel grading for multiple questions

**Database:**
- Index on `user_id` for fast queries
- Index on `class_id` for quiz lookups
- Use views for complex queries (quiz stats, etc.)

**File Storage:**
- Compress PDFs before storage
- Generate thumbnails for file previews (future)
- CDN for file delivery (Supabase handles this)

---

## Security Checklist

- [ ] All routes verify Supabase JWT token
- [ ] RLS policies prevent cross-user data access
- [ ] File uploads sanitized (virus scan in production)
- [ ] Rate limiting on expensive routes (grading, quiz gen)
- [ ] Stripe webhook signature verification
- [ ] No sensitive data in client-side code
- [ ] Proper CORS configuration

---

## Next Steps

1. **Create `/api/summarize.ts`** - Start with simple Claude integration
2. **Test prompt engineering** - Ensure summaries are high quality
3. **Build `/api/generate-quiz.ts`** - Focus on question variety
4. **Perfect `/api/grade.ts`** - This is your moat, nail the feedback quality!
5. **Wire up frontend** - Connect routes to UI components

---

**Remember:** The adaptive grading feedback is ChatGPA's superpower. Spend 80% of effort here making it genuinely helpful, encouraging, and educational. This is what students will pay for.
