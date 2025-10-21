# ChatGPA Setup Checklist

Complete guide to get ChatGPA running from the Carpool codebase.

## ✅ Repository Structure Complete

Your minimal repo structure is now ready:

```
chatgpa/
├── supabase/
│   ├── migrations/
│   │   ├── 20251021_chatgpa_init.sql    ✅ Created
│   │   └── [old Carpool migrations...]   ✅ Keep for history
│   └── seed/
│       └── demo.sql                      ✅ Created
├── web/
│   ├── api/
│   │   ├── summarize.ts                  ⏳ To build
│   │   ├── generate-quiz.ts              ⏳ To build
│   │   ├── grade.ts                      ⏳ To build
│   │   ├── upload-note.ts                ⏳ To build
│   │   ├── router.ts                     ✅ Exists (update)
│   │   └── stripe-webhook.ts             ✅ Exists (update)
│   ├── src/
│   │   ├── components/                   ✅ Exists (reuse)
│   │   ├── pages/
│   │   │   ├── Landing.tsx               ⏳ Rewrite
│   │   │   ├── Dashboard.tsx             ⏳ Build
│   │   │   ├── Quiz.tsx                  ⏳ Build
│   │   │   └── Results.tsx               ⏳ Build
│   │   ├── hooks/                        ✅ Exists (reuse auth)
│   │   ├── lib/
│   │   │   └── supabase.ts               ✅ Exists (reuse)
│   │   └── types/
│   └── .env.example                      ✅ Updated
├── README.md                              ✅ Updated
├── INFRASTRUCTURE_REUSE.md                ✅ Created
├── API_ROUTES.md                          ✅ Created
└── SETUP_CHECKLIST.md                     ✅ You are here
```

---

## 🗄️ Database Setup

### Step 1: Apply Migrations

1. **Log into Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project (or create new one)

2. **Run ChatGPA Init Migration**
   ```sql
   -- In Supabase SQL Editor, paste content from:
   -- supabase/migrations/20251021_chatgpa_init.sql
   ```

3. **Verify Tables Created**
   ```sql
   -- Check that these tables exist:
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('classes', 'notes', 'quizzes', 'quiz_attempts', 'usage_limits');
   ```

4. **Set Up Storage Bucket**
   - Go to Storage in Supabase Dashboard
   - Create bucket named `notes`
   - Set to **Private** (not public)
   - Apply RLS policies (uncomment lines in migration file)

### Step 2: Optional - Seed Demo Data

```sql
-- Replace 'YOUR_USER_ID' with your actual user ID from auth.users
-- Then paste content from: supabase/seed/demo.sql
```

---

## 🔑 Environment Variables

### Step 1: Copy Example File

```bash
cd web
cp .env.example .env.local
```

### Step 2: Fill in Required Keys

**Supabase (from Supabase Dashboard → Settings → API):**
```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...  # Settings → API → service_role
```

**Anthropic (from https://console.anthropic.com/):**
```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**Stripe (from https://dashboard.stripe.com/test/apikeys):**
```bash
STRIPE_SECRET_KEY_TEST=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # After creating webhook
```

**Create Stripe Products:**
1. Go to https://dashboard.stripe.com/test/products
2. Create 3 products:
   - **Cram Pass**: $12 one-time payment
   - **Monthly**: $9/month recurring
   - **Annual**: $79/year recurring
3. Copy price IDs to `.env.local`:
   ```bash
   STRIPE_PRICE_CRAM_TEST=price_xxxxx
   STRIPE_PRICE_MONTHLY_TEST=price_xxxxx
   STRIPE_PRICE_ANNUAL_TEST=price_xxxxx
   ```

**Optional:**
```bash
RESEND_API_KEY=re_xxxxx  # For email notifications
```

---

## 📦 Dependencies

### Step 1: Install Packages

```bash
# From project root
pnpm install

# Or from web directory
cd web
pnpm install
```

### Step 2: Add ChatGPA-Specific Dependencies

```bash
cd web
pnpm add @anthropic-ai/sdk          # Claude API client
pnpm add pdf-parse                  # PDF text extraction
pnpm add mammoth                    # DOCX text extraction
pnpm add zod                        # Schema validation (if not already installed)
```

---

## 🛠️ Build API Routes

Priority order (ship incrementally):

### Week 1: Core AI Routes

1. **`/api/summarize.ts`** (Day 1-2)
   - Basic Claude API integration
   - Test with sample notes
   - Return markdown summary

2. **`/api/generate-quiz.ts`** (Day 2-3)
   - Generate 5-10 questions from notes
   - Mix multiple choice + short answer
   - Store in database

3. **`/api/grade.ts`** (Day 3-5)
   - **THE MOST IMPORTANT ROUTE**
   - Adaptive grading with encouraging feedback
   - Test extensively with various answers
   - This is your moat - perfect the prompt

### Week 2: File Upload + Dashboard

4. **`/api/upload-note.ts`** (Day 6-7)
   - Handle file upload to Supabase Storage
   - Extract text from PDF/DOCX
   - Store note in database

5. **Update `/api/router.ts`** (Day 8-9)
   - Add ChatGPA actions:
     - `get-classes`
     - `create-class` (with limit check)
     - `get-quizzes`
     - `check-limits`

6. **Update `/api/stripe-webhook.ts`** (Day 10)
   - Handle new tier names (cram, monthly, annual)
   - Set expiration for cram pass (7 days)

---

## 🎨 Build Frontend Pages

### Week 1: Landing + Dashboard

1. **Rewrite `Landing.tsx`** (Day 1-2)
   - New hero: "Exam in 3 days? Upload notes → Get quizzes → Pass"
   - Features section
   - Pricing cards (Free, Cram, Monthly, Annual)
   - Remove Carpool fuel metaphors

2. **Build `Dashboard.tsx`** (Day 3-4)
   - List user's classes
   - "Create Class" button (with limit check)
   - Show quiz count per class
   - Navigate to class detail

3. **Build `ClassDetail.tsx`** (Day 5)
   - Upload notes (text paste or file)
   - List notes for this class
   - Generate quiz button
   - List quizzes taken

### Week 2: Quiz Flow

4. **Build `Quiz.tsx`** (Day 6-7)
   - Display questions one at a time (or all at once)
   - Input fields for answers
   - Submit button
   - Loading state while grading

5. **Build `Results.tsx`** (Day 8-9)
   - Display adaptive grading feedback
   - Show score
   - Highlight concept understanding vs terminology
   - Encouraging messaging
   - "Retake Quiz" button

---

## 🧪 Testing Plan

### Manual Testing Checklist

**Auth Flow:**
- [ ] Sign up with magic link
- [ ] Log in
- [ ] Log out

**Free Tier Limits:**
- [ ] Create 1 class (should work)
- [ ] Try to create 2nd class (should be blocked)
- [ ] Take 5 quizzes (should work)
- [ ] Try 6th quiz (should prompt upgrade)

**Note Upload:**
- [ ] Paste text notes
- [ ] Upload .txt file
- [ ] Upload .pdf file
- [ ] Upload .docx file
- [ ] Verify text extraction works

**Quiz Generation:**
- [ ] Generate quiz from notes
- [ ] Verify mix of question types
- [ ] Verify questions are relevant

**Adaptive Grading:**
- [ ] Submit correct answer → see encouragement
- [ ] Submit partial answer → see nuanced feedback
- [ ] Submit wrong answer → see educational correction
- [ ] Verify tone is kind, not harsh

**Payment:**
- [ ] Purchase Cram Pass (test mode)
- [ ] Verify unlimited access
- [ ] Verify expires after 7 days
- [ ] Subscribe to Monthly
- [ ] Cancel subscription

---

## 🚀 Deployment

### Vercel Setup

1. **Connect GitHub Repo**
   - Go to https://vercel.com
   - Import your `chatgpa` repository

2. **Configure Environment Variables**
   - Add all variables from `.env.local`
   - Use production keys for `LIVE` mode

3. **Set Build Command**
   ```bash
   cd web && pnpm build
   ```

4. **Set Output Directory**
   ```
   web/dist
   ```

5. **Deploy**
   - Vercel will auto-deploy on push to `main`

### Stripe Webhook Setup

1. **Get Vercel URL** (e.g., `https://chatgpa.vercel.app`)

2. **Create Stripe Webhook**
   - Go to https://dashboard.stripe.com/webhooks
   - Add endpoint: `https://chatgpa.vercel.app/api/stripe-webhook`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

3. **Copy Webhook Secret**
   - Add to Vercel env: `STRIPE_WEBHOOK_SECRET=whsec_xxx`

---

## 📊 Week 1-2 Timeline

**Day 1-2:**
- [x] Repo structure (DONE)
- [x] Database migration (DONE)
- [x] Environment setup (DONE)
- [ ] `/api/summarize` route
- [ ] Rewrite Landing page

**Day 3-4:**
- [ ] `/api/generate-quiz` route
- [ ] Build Dashboard page
- [ ] Test quiz generation

**Day 5:**
- [ ] `/api/grade` route (start)
- [ ] Build ClassDetail page
- [ ] Perfect grading prompts

**Day 6-7:**
- [ ] Finish `/api/grade` (the moat!)
- [ ] `/api/upload-note` route
- [ ] Build Quiz page

**Day 8-9:**
- [ ] Update `/api/router`
- [ ] Build Results page
- [ ] End-to-end testing

**Day 10:**
- [ ] Update Stripe webhook
- [ ] Deploy to Vercel
- [ ] Beta testing with 3-5 students

**Day 11-14:**
- [ ] Fix bugs from beta
- [ ] Polish UI
- [ ] Get 10 beta users

---

## 🎯 Success Criteria

**Technical:**
- [ ] All 3 core AI routes working (summarize, quiz, grade)
- [ ] File upload (PDF/DOCX) working
- [ ] Free tier limits enforced
- [ ] Stripe payment working
- [ ] Deployed to production

**Product:**
- [ ] Generate quizzes in <10 seconds
- [ ] Adaptive grading feels encouraging, not robotic
- [ ] Students say "this helped me study"
- [ ] 10 beta users testing

**Business:**
- [ ] 3+ beta users ask "when can I pay?"
- [ ] 5+ users say "this is better than NotebookLM/Quizlet"
- [ ] Grading quality is noticeably better than competitors

---

## 🚨 Common Issues

**Claude API errors:**
- Check API key is correct
- Verify you have credits in Anthropic account
- Check prompt length (<100k tokens)

**File upload fails:**
- Verify Supabase Storage bucket exists
- Check RLS policies are set
- Verify file size under limit

**Free tier not enforcing:**
- Check RPC functions exist (`can_create_class`, `can_take_quiz`)
- Verify increment functions are called after creation

**Stripe webhook not working:**
- Verify webhook URL is correct
- Check webhook secret matches
- Use Stripe CLI for local testing:
  ```bash
  stripe listen --forward-to localhost:5173/api/stripe-webhook
  ```

---

## 📚 Resources

- [Anthropic Claude API Docs](https://docs.anthropic.com/)
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Stripe Subscriptions Guide](https://stripe.com/docs/billing/subscriptions/overview)
- [ChatGPA MVP Strategy](./chatgpa_mvp.txt)
- [API Routes Documentation](./API_ROUTES.md)
- [Infrastructure Reuse Guide](./INFRASTRUCTURE_REUSE.md)

---

## 🎉 You're Ready!

All planning is done. Database schema is ready. Infrastructure is documented.

**Next step:** Start building `/api/summarize.ts` and test your first Claude API integration.

The entire MVP is 1-2 weeks away. Let's ship! 🚀
