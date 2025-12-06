# Session 23: Landing Page Copy & Spacing Refinement

**Date**: November 28, 2025
**Branch**: `alpha`
**Focus**: Landing page content refinement, honest feature framing, improved typography & spacing

---

## Overview

Refined all 9 landing page components with cleaner copy, improved vertical rhythm, and honest framing of aspirational features. No structural changes—only typography, spacing (Tailwind classes), and microcopy adjustments.

**Design Philosophy**: Notion + Linear + Vercel energy—calm, elegant, modern, and honest.

---

## Changes by Component

### 1. Hero.tsx
**Location**: `web/src/components/landing/Hero.tsx`

**Copy Changes**:
- Fixed headline spacing: "Studying sucks. Let's make it easier."
- Simplified subheadline to two punchy sentences:
  ```
  Turn messy notes into focused quizzes.
  See exactly what you don't know yet.
  ```
- Shortened microcopy: "Free to start. No credit card required."

**Spacing Adjustments**:
- Subheadline margin: `mb-8` → `mb-10`

---

### 2. HowItWorks.tsx
**Location**: `web/src/components/landing/HowItWorks.tsx`

**Copy Changes**:
- Headline: "Three steps to better studying" → **"Three steps. That's it."**
- Step descriptions condensed:
  - Step 01: "Paste text or upload PDFs. Messy notes are fine—we work with what you have."
  - Step 02: "AI reads your material and creates questions covering key concepts. Pick your topic and question count."
  - Step 03: "Answer questions and get instant feedback. Know exactly which topics need work."
- Bottom copy: "No complex setup. No learning curve."
- CTA text: "Start your first quiz" → **"Try it now"**

**Spacing Adjustments**:
- Section header margin: `mb-16` → `mb-20`
- Bottom CTA margin: `mt-12` → `mt-16`
- CTA text margin: `mb-4` → `mb-5`
- Section label margin: `mb-3` → `mb-4`

---

### 3. FirstSession.tsx
**Location**: `web/src/components/landing/FirstSession.tsx`

**Copy Changes**:
- Headline: "What your first 5 minutes look like" → **"Your first 5 minutes"**
- Intro: "No tutorials. No wizards. Just add notes and start quizzing."
- Timeline descriptions drastically shortened:
  - Minute 1: "Name it anything. 'Bio Final.' 'Chapter 7.' Whatever."
  - Minutes 2–3: "Paste text or drop a PDF. Formatting doesn't matter."
  - Minute 4: "Pick question count. Hit generate. Takes about 30 seconds."
  - Minute 5: "Answer at your own pace. Get feedback on each question. Know what to study."
- CTA: "Get started free" → **"Start for free"**

**Spacing Adjustments**:
- Section header margin: `mb-16` → `mb-20`
- Section label margin: `mb-3` → `mb-4`
- Headline margin: `mb-4` → `mb-5`
- Bottom CTA margins: `mt-12` → `mt-16`, `pt-8` → `pt-10`, `mb-4` → `mb-6`

---

### 4. WhyItMatters.tsx
**Location**: `web/src/components/landing/WhyItMatters.tsx`

**Copy Changes**:
All 6 reason cards condensed to ultra-concise format:

| Old Title | New Title | Old Description | New Description |
|-----------|-----------|-----------------|-----------------|
| Makes it easy to start | **Easy to start** | No perfect notes required... | No perfect notes required. Paste what you have. |
| Shows you what you don't know | **Shows knowledge gaps** | Stop guessing which topics... | Stop guessing. See which topics need work. |
| Turns chaos into a study plan | **Structure from chaos** | Random notes become... | Random notes become focused questions. |
| Works at your pace | **Your own pace** | Study for 5 minutes... | 5 minutes or 5 hours. Pause anytime. |
| Actually explains the answers | **Real feedback** | When you get something wrong... | Understand why you got it wrong. Not just "incorrect." |
| No commitment to start | **Free to try** | Free to try. No credit card... | No credit card. Cancel anytime. |

**Spacing Adjustments**:
- Section header margin: `mb-16` → `mb-20`
- Section label margin: `mb-3` → `mb-4`

---

### 5. ProductPreview.tsx ⭐
**Location**: `web/src/components/landing/ProductPreview.tsx`

**CRITICAL HONESTY UPDATES**:

**Header Changes**:
- Section label: "See inside" → **"Product vision"**
- Headline: "What you'll actually use" → **"Where we're headed"**
- Subheadline: "This preview shows our north star. Some features are live. Others are in development."

**Floating Annotation Updates** (Honest Feature Framing):
1. **Note organization**:
   - Before: "All your uploaded material, organized by topic"
   - After: **"Coming soon: Topic-based organization"**

2. **Smart questions**:
   - Before: "Generated from your specific notes, not generic flashcards"
   - After: **"Generated from your notes"** (live feature, kept honest)

3. **Progress tracking**:
   - Before: "See which topics need work—red means review, green means ready"
   - After: **"In development: Per-topic scoring"**

**Spacing Adjustments**:
- Section header margin: `mb-16` → `mb-20`
- Section label margin: `mb-3` → `mb-4`
- Headline margin: `mb-4` → `mb-5`

---

### 6. Pricing.tsx ⭐
**Location**: `web/src/components/landing/Pricing.tsx`

**FEATURE TRANSPARENCY UPDATES**:

**Monthly Plan Features**:
- Added **(coming soon)** to "Export to PDF"

**Annual Plan Features**:
- Added **(roadmap)** to "Study group sharing"

**Header Changes**:
- Headline: "Start free. Upgrade when you're ready." → **"Start free. Upgrade when ready."**
- Subheadline: "No pressure, no hidden fees. The free plan is actually useful—not a teaser." → **"No pressure. No hidden fees. Free plan is actually useful."**

**Spacing Adjustments**:
- Section header margin: `mb-12` → `mb-16`
- Section label margin: `mb-3` → `mb-4`
- Headline margin: `mb-4` → `mb-5`

---

### 7. FAQ.tsx
**Location**: `web/src/components/landing/FAQ.tsx`

**Copy Changes**:
All questions and answers drastically shortened:

| Old Question | New Question | Changes to Answer |
|--------------|--------------|-------------------|
| Do I need perfect notes to use ChatGPA? | **Do I need perfect notes?** | Condensed to 2 sentences |
| Can I use it last-minute before an exam? | **Can I use it last-minute?** | Removed fluff, kept core message |
| Is my data private? | (same) | Shortened to essentials |
| What if I don't like it? | (same) | Removed "no hoops to jump through" |
| What types of content can I upload? | **What file types work?** | Added honesty: "Text and PDFs work now. More formats (Word, PowerPoint) coming soon." |

**Header Changes**:
- Headline: "Questions? Answered." → **"Common questions"**

**Contact CTA**:
- Simplified email link (removed "Reach out →")

**Spacing Adjustments**:
- Section header margin: `mb-12` → `mb-16`
- Section label margin: `mb-3` → `mb-4`
- Contact CTA margins: `mt-10` → `mt-12`, `pt-8` → `pt-10`, `mb-2` → `mb-3`

---

### 8. Footer.tsx
**Location**: `web/src/components/landing/Footer.tsx`

**Copy Changes**:
- Tagline: "Built for students who start late and still want to pass." → **"Study smarter. Stress less."**

**Rationale**: More professional, aspirational, and aligned with Notion/Linear energy.

---

### 9. Header.tsx
**Location**: `web/src/components/landing/Header.tsx`

**No changes** - Already clean and minimal.

---

## Spacing Pattern Summary

**Consistent vertical rhythm adjustments**:
- Section headers: `mb-16` → `mb-20` (more breathing room)
- Section labels: `mb-3` → `mb-4` (cleaner spacing)
- Headline margins: `mb-4` → `mb-5` (where applicable)
- Bottom CTAs: Increased padding/margins for better visual separation

**Philosophy**: Create calmer, more professional spacing reminiscent of Linear's design system.

---

## Key Principles Applied

### 1. **Shorter Sentences**
- Removed unnecessary elaboration
- Focused on core value props
- Confident, not wordy

### 2. **Honest Feature Framing**
Used terminology to ground aspirational features:
- **"Coming soon"** - Near-term features
- **"In development"** - Active work in progress
- **"Roadmap"** - Planned but not yet started
- **"(format) coming soon"** - File type support

### 3. **Improved Vertical Rhythm**
- Consistent spacing hierarchy
- Better visual breathing room
- Professional polish

### 4. **Tone & Voice**
- Friendly but professional
- Relatable to students
- Honest about current state
- Optimistic about future
- "Studying sucks. Let's make it easier." energy

### 5. **No Over-Engineering**
- Zero structural changes
- No new components
- Only typography & spacing
- Design tokens preserved

---

## Impact

✅ **More honest**: Users know what's live vs. coming
✅ **More professional**: Cleaner copy, better rhythm
✅ **More confident**: Shorter sentences, less fluff
✅ **More elegant**: Notion/Linear/Vercel aesthetic
✅ **North star preserved**: Aspirational features still shown

---

## Files Modified

1. `web/src/components/landing/Hero.tsx`
2. `web/src/components/landing/HowItWorks.tsx`
3. `web/src/components/landing/FirstSession.tsx`
4. `web/src/components/landing/WhyItMatters.tsx`
5. `web/src/components/landing/ProductPreview.tsx` ⭐
6. `web/src/components/landing/Pricing.tsx` ⭐
7. `web/src/components/landing/FAQ.tsx`
8. `web/src/components/landing/Footer.tsx`

**Total**: 8 files modified (Header.tsx unchanged)

---

## Testing Checklist

After deployment, verify:
- [ ] All text renders correctly (no layout breaks)
- [ ] Spacing looks balanced on mobile, tablet, desktop
- [ ] FAQ accordion still works
- [ ] Mobile menu still functions
- [ ] All CTAs link to `/signin`
- [ ] Section anchors work (`#how-it-works`, `#pricing`, `#faq`)
- [ ] "Coming soon" / "In development" labels are visible
- [ ] No CSS variable errors in console

---

## Next Steps

**Potential follow-ups**:
1. Add a "Roadmap" page showing all upcoming features
2. Implement feature flags to conditionally show "coming soon" badges
3. Create a changelog/updates page for transparency
4. Add testimonials section (once we have real users)
5. Consider A/B testing different hero copy variations

---

## Notes

- This was a **refinement pass**, not a redesign
- All component structure preserved
- Design system variables untouched
- Landing page now reflects both current features AND north star
- No misleading claims—honest about what's live vs. planned
