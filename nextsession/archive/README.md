# 🗄️ Archived Documentation

This folder contains historical documentation from ChatGPA's evolution from alpha to production (October-November 2025).

**Archived:** 2025-11-04
**Reason:** Session 2 work (RLS hardening, real data integration, ClassNotes page) superseded these documents.

---

## 📁 Archive Structure

### handoffs/ (3 files)
Previous session handoffs documenting completed work:
- `HANDOFF_2025_10_23_V5_MINIMAL_FIX.md` — OpenAI v5 integration fixes
- `HANDOFF_2025_10_27_ALPHA_FIXES.md` — 6 critical alpha bug fixes
- `2025_11_03_chatgpa_dashboard_handoff.md` — Session 1 dashboard phase

**Historical Value:** Shows progression from API fixes → alpha stabilization → dashboard integration

---

### context/ (2 files)
Earlier context documents capturing project state:
- `CONTEXT_API_IMPLEMENTATION_2025_10_22.md` — Original API design and RLS approach
- `context_v4_final.md` — Comprehensive alpha-ready state snapshot

**Historical Value:** Documents foundational API architecture decisions and pre-production state

---

### verification/ (1 file)
QA reports and testing artifacts:
- `VERIFICATION_REPORT_2025_10_26.md` — Systematic bug identification (6 bugs)

**Historical Value:** Excellent example of thorough QA process; informed alpha fixes

---

### prompts/ (1 file)
System prompt templates:
- `Claude_Prompt_v5.md` — Version 5 prompt template with context references

**Historical Value:** Template for creating updated prompts; documents v5 workflow patterns

---

### brand/ (1 file)
Brand guidelines:
- `brand_kit.md` — Coral × Leaf × Stone color palette and design direction

**Historical Value:** Aspirational brand identity (not yet implemented; theme.css uses neutral palette)

---

### meta/ (1 file)
Collaboration notes:
- `Jerry_and_me.md` — Meta-commentary on collaboration workflow

**Historical Value:** May document unique collaboration patterns

---

## 🔍 When to Reference Archive

### Good Use Cases:
- **Understanding evolution:** How did we get here?
- **Retrieving decisions:** Why did we choose this approach?
- **Learning from bugs:** What issues did we encounter?
- **Template reference:** Need to write similar docs?

### Not Recommended:
- **Active development:** Use current docs (parent folder)
- **API contracts:** Check current ARCHITECTURE.md (may have evolved)
- **Schema reference:** Use latest migration files

---

## 📊 What Changed Since Archive

**Session 2 (2025-11-04) introduced:**
- Parent-ownership RLS policies (notes, quiz_attempts)
- Real data integration (dashboard fetches notes, Results displays attempts)
- ClassNotes page for data seeding
- Complete end-to-end study loop
- Migration: `20251104_notes_attempts_rls.sql`

**Superseded information:**
- API implementation details (evolved with RLS hardening)
- Frontend bug states (all fixed per HANDOFF_2025_10_27)
- Dashboard evolution (two versions archived; current in Session 2 docs)
- Alpha state snapshots (now production-ready)

---

## 🗂️ Archive Maintenance

**Preservation Policy:** Never delete. All docs have historical value.

**When to add to archive:**
- After major milestones that supersede previous documentation
- When Session N+1 docs make Session N docs obsolete
- Keep 2-3 most recent sessions active; archive older

**Organization:**
- Group by type (handoffs, context, verification, etc.)
- Maintain chronological naming
- Update this README when adding files

---

**Archive Created:** 2025-11-04
**Files Archived:** 9
**Active Docs:** 4 (README, QUICK_START, ARCHITECTURE, Dashboard_Session_2)
