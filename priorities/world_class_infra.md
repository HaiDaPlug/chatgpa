## Your brain dump roadmap (ordered the way you described)

1. **Make the navbar great**
2. **Design overhaul** (Gemini pass page-by-page)
3. **localStorage persistence** ✅ done (Session 29)
4. **Modernize Results page** (Results/Review parity with the new quiz UI)
5. **Overhaul design system**
6. **Make the quiz generator truly “world-class”** (polish + insights + safety)

---

## “World-class quiz generator” gaps (from the earlier analysis you pasted, anchored to repo reality)

**Must-have UX/Safety (blocking):**

* ✅ localStorage persistence (done)
* Navigation blocking (needs Router migration + `useBlocker`)
* Rate limiting (explicitly noted as missing) 

**Should-have (competitive):**

* Progress analytics dashboard (scores over time, weak topics)
* Surface “question quality” metrics you already store (coverage/diversity/duplicates)
* Better real-time generation feedback (stepwise “analyzing → generating…”)

**Nice-to-have (polish/infra):**

* Bundle splitting / lazy route loads 
* E2E tests (Playwright/Cypress) 
* Realtime attempt sync (results updates across tabs)

(Repo context for what’s already “working” and what’s “known limitations” lives in CURRENT_STATE + README.)