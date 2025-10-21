✅ Locked-in behavior (we don’t need to rethink this again)

Quiz length: 5–10 questions, adaptive to note size.

Type mix: Auto hybrid (default) → adjusts to material.

MCQ options: 4 per question.

Typed answers: soft limit 200 chars, accepts small errors, synonyms, paraphrasing.

Language: auto-detect per class.

Navigation: can skip & return.

No timer, shuffle questions each attempt.

Submit: allowed with warnings for unanswered.

After submit: show correct answers, short tip per question, one-line summary.

Attempts: unlimited, saved for progress view.

Score: percentage (0–100).

🚀 MVP Features (first public version)

These are the pieces that make ChatGPA feel finished while staying lightweight and testable:

1. Create Class + Notes Upload

Students can create a class and upload notes (text or file).

Notes auto-saved in Supabase (notes table + storage).

Auto-detect language for each note.

2. Generate Quiz

Button: “Generate Quiz from Notes.”

Calls /api/generate-quiz → uses QUIZ_GENERATOR.md.

Returns JSON of 5–10 adaptive questions (based on notes length).

Stored in quizzes table under that class.

3. Take Quiz

Clean quiz interface (like a real test):

Navigation panel to jump between questions.

Option to skip and come back.

Progress indicator (e.g., “7/10 answered”).

“Submit Quiz” button → confirm → show results.

4. Adaptive Grading

/api/grade endpoint uses GRADER.md.

Checks typed answers leniently (spelling, synonyms, paraphrase).

Gives per-question feedback + final summary.

Saves attempt in quiz_attempts table.

5. Results View

Show:

Score (%)

Per-question correctness

Correct answers

Feedback + summary line

Stored attempts viewable later (progress over time).

6. User Limits + Stripe Logic

Free plan: 1 class + 5 total quizzes.

Paid plan ($9/mo): unlimited classes/quizzes.

Subscription table + webhook (already in schema).

7. Basic UI polish

Dark/light neutral theme with one accent color.

Smooth transitions when moving between question & result views.

Responsive layout (mobile-friendly).

Toasts for warnings (“3 unanswered questions”).

🧱 Later (after MVP)

We can add after validation:

AI summary before quiz (“Here’s what this note mainly covers”).

Difficulty tags (1–5) for each question.

Partial credit & deeper feedback (fractional scoring).

Performance graphs per class.

Local caching for offline review.