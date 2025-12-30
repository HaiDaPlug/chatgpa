🎯 MUST HAVE (Critical for World-Class Status)
1. localStorage Persistence ✅ DONE (Session 29)
Users lose all progress on refresh
Status: Complete with order-aware validation and hydration guards
2. Server-Side Autosave + Resume ✅ DONE (Session 31)
Cross-device/browser resume
Status: Complete with conflict resolution and 800ms debounce
3. Retake Analytics Dashboard 📊
Why Critical: Session 27 added true retake, but no visibility into adoption
What's Missing:
Retake → completion rate tracking
Average score improvement metrics
Perfect score rate on 2nd+ attempts
User engagement with mastery loop
Foundation: Telemetry events already exist (Session 27)
Impact: Data-driven decisions about mastery loop effectiveness
Priority: HIGH - You can't improve what you don't measure
4. Rate Limiting ⚡
Why Critical: No protection against API abuse
What's Missing:
Folder CRUD endpoints have no limits (can spam creates)
AI endpoints unprotected (could burn through OpenAI credits)
No per-user throttling
Impact: Production vulnerability, cost control
Implementation: Redis-based limiter or Vercel Edge middleware
Priority: HIGH - Security and cost risk
💎 SHOULD HAVE (High-Value UX)
5. Navigation Blocking 🚧
Why Important: Users can't lose progress (autosave mitigates, but UX warning still valuable)
What's Missing:
Migrate from <BrowserRouter> to createBrowserRouter
Implement useBlocker on QuizPage
"You have unsaved answers" warning dialog
Impact: Prevents accidental navigation away mid-quiz
Priority: MEDIUM (lower since Session 31 autosave reduces risk)
6. Score Comparison Chart 📈
Why Important: Visual motivation for mastery loop
What's Missing:
Attempt 1 vs 2 vs 3 score visualization
Retake count badge on quiz cards
"Study Suggestions" based on weak question patterns
Foundation: Session 27 true retake enables this
Impact: Gamification increases engagement
Priority: MEDIUM - Complements retake analytics
7. Missing Material Analysis 🔍
Why Important: Pre-quiz gap detection improves learning outcomes
What's Missing:
AI scan of notes before quiz generation
Identify conceptual gaps or shallow coverage
Example: "Your notes don't cover photosynthesis in depth"
Suggest improvements to notes
Impact: Proactive quality control, better quizzes
Priority: MEDIUM - Differentiator from competitors
8. Rich Text Editor ✍️
Why Important: Current textarea is basic, limits note quality
What's Missing:
Upgrade to TipTap or Lexical editor
Markdown support (headings, lists, code blocks)
Formatting toolbar (bold, italic, highlights)
Image/diagram embedding
Impact: Better notes → better quizzes
Priority: MEDIUM - UX polish
🌟 NICE TO HAVE (Polish & Scale)
9. Real-Time Updates 🔄
Why Nice: Results page doesn't reflect new attempts without refresh
What's Missing:
Supabase realtime subscriptions on quiz_attempts
Live score updates on Results page
Toast notification "New quiz graded!"
Impact: Feels more responsive (especially for retakes)
Priority: LOW - Manual refresh works fine
10. E2E Testing 🧪
Why Nice: Catch regressions before production
What's Missing:
Playwright or Cypress test suite
Critical flows: signup → upload notes → generate → take → submit
Visual regression testing
Impact: Confidence in deployments
Priority: LOW - Manual testing currently sufficient
11. Bundle Size Optimization 📦
Why Nice: Faster initial load
What's Missing:
Lazy loading routes with React.lazy()
Code splitting per route
Tree-shaking unused dependencies
Current: 616.42 kB gzipped (Session 33)
Impact: Marginal performance improvement (already fast)
Priority: LOW - Current size acceptable
12. Pagination for Large Classes 📄
Why Nice: ClassNotes loads all notes at once
What's Missing:
Virtual scrolling or cursor-based pagination
Only critical for 100+ notes per class
Current: Works fine for typical use (< 50 notes)
Impact: Edge case performance
Priority: LOW - Not a bottleneck yet
📊 Updated Priority Ranking
Rank	Feature	Priority	Impact	Effort	Status
1	localStorage Persistence	MUST HAVE	Critical	Medium	✅ DONE
2	Server-Side Autosave	MUST HAVE	Critical	High	✅ DONE
3	Retake Analytics Dashboard	MUST HAVE	Critical	Medium	🟡 TODO
4	Rate Limiting	MUST HAVE	High	Medium	🟡 TODO
5	Navigation Blocking	SHOULD HAVE	Medium	Low	🟡 TODO
6	Score Comparison Chart	SHOULD HAVE	Medium	Medium	🟡 TODO
7	Missing Material Analysis	SHOULD HAVE	Medium	High	🟡 TODO
8	Rich Text Editor	SHOULD HAVE	Medium	High	🟡 TODO
9	Real-Time Updates	NICE TO HAVE	Low	Medium	🟡 TODO
10	E2E Testing	NICE TO HAVE	Low	High	🟡 TODO
11	Bundle Size Optimization	NICE TO HAVE	Low	Medium	🟡 TODO
12	Pagination for Large Classes	NICE TO HAVE	Low	Low	🟡 TODO
🎯 Recommended Next Steps
Immediate Focus (based on impact/effort ratio):
Retake Analytics Dashboard - Measure mastery loop effectiveness (telemetry already exists)
Rate Limiting - Protect production from abuse (security/cost risk)
Score Comparison Chart - Quick win for UX (builds on Session 27 retake)
After that:
Navigation blocking (data router migration)
Missing material analysis (differentiation)
Rich text editor (note quality)
The backend is already world-class (AI router, grading, RLS security, autosave). The remaining gaps are mostly analytics visibility, security hardening, and UX polish.

Take with a pinch of salt.