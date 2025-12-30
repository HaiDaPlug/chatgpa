#### A) **Production Beta** (public link, free users, stable core loop)

You’re **~6 priorities** away.

1. **Canonize Results**

   * Make sure the *actual* post-submit route renders the new AttemptReview UI (not just AttemptDetail).
   * Remove the last token violations + smoke tests (all-correct / mixed / all-wrong + mobile).

2. **API relays are bulletproof** (`/api/generate-quiz`, `/api/grade`)

   * Zod validation, consistent `{ code, message }`, good failure UX, timeouts.

3. **Usage limits enforcement + UX**

   * Free plan caps actually enforced (not just “intended”), with clear messaging when you hit limits.

4. **Attempts lifecycle integrity**

   * No weird states: partial grading, missing feedback, retries, idempotency on submit.

5. **Observability**

   * Basic error tracking + server logs you can rely on when something breaks (otherwise “production” becomes chaos).

6. **Security sanity pass**

   * RLS assumptions verified, payload size caps, input validation, safe defaults.

If those 6 are green → you can ship a real beta without fear.

---

#### B) **Full Production Launch** (paying users + “I can market this hard”)

You’re **~10–12 priorities** away total (the 6 above + ~4–6 more):

7. **Stripe end-to-end** (subscribe/upgrade/cancel/webhooks/sync)
8. **Legal basics** (privacy policy/terms, cookie notice if needed)
9. **Performance polish** (loading states, caching where appropriate, no jank on low-end)
10. **Abuse/rate limiting** (esp. quiz generation)
11. **Onboarding clarity** (first quiz success in minutes)
12. **Recovery/support** (reset flows, resend email, “contact” path)