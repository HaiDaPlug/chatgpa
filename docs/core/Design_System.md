# ChatGPA  Design System

**Version**: 7.0
**Last Updated**: November 18, 2025
**Status**: Section 7 Complete

---

## Overview

ChatGPA uses a **token-based design system** with semantic naming, WCAG AA compliance, and brand-consistent visuals.

**Core Principles**:
1. **Token-First**: All colors, spacing, typography via CSS custom properties
2. **Dark Mode Native**: Optimized for low-light reading
3. **Accessible**: WCAG AA (4.5:1 contrast minimum)
4. **Responsive**: Mobile-first with breakpoints
5. **Motion Subtle**: Fast, purposeful animations

---

## Design Tokens

All tokens defined in `web/src/theme-tokens.css`

### Color Palette

#### Brand Colors
```css
--color-accent: hsl(350, 85%, 55%);        /* Coral #EE4266 */
--color-success: hsl(145, 70%, 45%);       /* Leaf #2A9D5F */
--color-warning: hsl(40, 95%, 55%);        /* Amber #F5A623 */
--color-error: hsl(0, 75%, 50%);           /* Red #DF2935 */
```

#### Background Colors
```css
--color-bg-primary: hsl(217, 33%, 7%);     /* Dark blue-black #0A0E14 */
--color-bg-secondary: hsl(217, 28%, 10%);  /* Slightly lighter #131820 */
--color-bg-tertiary: hsl(217, 24%, 13%);   /* Panel background #1A2028 */
```

#### Surface Colors
```css
--color-surface: hsl(217, 20%, 16%);       /* Card/modal background #232A35 */
--color-surface-hover: hsl(217, 22%, 19%); /* Interactive hover #2A333F */
--color-surface-active: hsl(217, 24%, 22%);/* Interactive press #323C4A */
```

#### Text Colors
```css
--color-text-primary: hsl(210, 40%, 98%);   /* Off-white #FAFBFC */
--color-text-secondary: hsl(210, 15%, 70%); /* Muted gray #A8B2BC */
--color-text-tertiary: hsl(210, 12%, 50%);  /* Dim gray #7A8591 */
--color-text-disabled: hsl(210, 10%, 35%);  /* Very dim #535B65 */
```

#### Border Colors
```css
--color-border-default: hsl(217, 18%, 24%); /* Subtle border #363F4D */
--color-border-hover: hsl(217, 20%, 32%);   /* Hover border #495464 */
--color-border-focus: var(--color-accent);  /* Focus outline (coral) */
```

### Spacing Scale

```css
--spacing-xs: 0.25rem;  /* 4px */
--spacing-sm: 0.5rem;   /* 8px */
--spacing-md: 1rem;     /* 16px */
--spacing-lg: 1.5rem;   /* 24px */
--spacing-xl: 2rem;     /* 32px */
--spacing-2xl: 3rem;    /* 48px */
--spacing-3xl: 4rem;    /* 64px */
```

### Typography

#### Font Families
```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-serif: 'Georgia', 'Times New Roman', serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

#### Font Sizes
```css
--font-size-xs: 0.75rem;    /* 12px */
--font-size-sm: 0.875rem;   /* 14px */
--font-size-base: 1rem;     /* 16px */
--font-size-lg: 1.125rem;   /* 18px */
--font-size-xl: 1.25rem;    /* 20px */
--font-size-2xl: 1.5rem;    /* 24px */
--font-size-3xl: 1.875rem;  /* 30px */
--font-size-4xl: 2.25rem;   /* 36px */
```

#### Font Weights
```css
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

#### Line Heights
```css
--line-height-tight: 1.25;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
```

### Border Radius

```css
--radius-sm: 0.25rem;  /* 4px */
--radius-md: 0.5rem;   /* 8px */
--radius-lg: 0.75rem;  /* 12px */
--radius-xl: 1rem;     /* 16px */
--radius-full: 9999px; /* Pills/circles */
```

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.15);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.2);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.25);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.3);
```

### Z-Index Scale

```css
--z-dropdown: 1000;
--z-sticky: 1020;
--z-modal-backdrop: 1040;
--z-modal: 1050;
--z-popover: 1060;
--z-tooltip: 1070;
```

---

## Component Patterns

### Buttons

```tsx
// Primary button (accent color)
<button className="btn-primary">
  Generate Quiz
</button>

// CSS
.btn-primary {
  background: var(--color-accent);
  color: var(--color-text-primary);
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-semibold);
  transition: background 150ms ease;
}

.btn-primary:hover {
  background: hsl(350, 85%, 60%); /* Lighter coral */
}

.btn-primary:active {
  background: hsl(350, 85%, 50%); /* Darker coral */
}
```

### Cards

```tsx
// Surface card with hover effect
<div className="card">
  <h3>Class Name</h3>
  <p>Description</p>
</div>

// CSS
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  transition: transform 150ms ease, border-color 150ms ease;
}

.card:hover {
  transform: translateY(-2px);
  border-color: var(--color-border-hover);
}
```

### Inputs

```tsx
// Text input
<input
  type="text"
  className="input"
  placeholder="Enter class name..."
/>

// CSS
.input {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-base);
  transition: border-color 150ms ease;
}

.input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px hsla(350, 85%, 55%, 0.2);
}

.input::placeholder {
  color: var(--color-text-tertiary);
}
```

### Modals

```tsx
// Modal structure
<div className="modal-backdrop">
  <div className="modal">
    <header className="modal-header">
      <h2>Modal Title</h2>
      <button aria-label="Close">×</button>
    </header>
    <div className="modal-body">
      {/* Content */}
    </div>
    <footer className="modal-footer">
      <button className="btn-secondary">Cancel</button>
      <button className="btn-primary">Confirm</button>
    </footer>
  </div>
</div>

// CSS
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: var(--z-modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  z-index: var(--z-modal);
}
```

---

## Motion System

### Timing Functions

```css
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### Durations

```css
--duration-fast: 150ms;
--duration-base: 250ms;
--duration-slow: 350ms;
```

### Animation Examples

**Page Transitions** (with Framer Motion):
```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: 6 }}
  transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
>
  {/* Page content */}
</motion.div>
```

**Card Hover**:
```css
.card {
  transition: transform var(--duration-fast) var(--ease-out);
}

.card:hover {
  transform: translateY(-2px);
}
```

**Modal Fade In**:
```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.95 }}
  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
>
  {/* Modal */}
</motion.div>
```

---

## Visual Assets

### Asset Manifest

Located at `web/src/brand/manifest.json`:

```json
{
  "version": "1.0",
  "assets": {
    "frames": {
      "coral-arch": {
        "path": "/brand/frames/coral-arch.svg",
        "type": "decorative",
        "placement": "header"
      },
      "leaf-corner": {
        "path": "/brand/frames/leaf-corner.svg",
        "type": "decorative",
        "placement": "footer"
      }
    },
    "patterns": {
      "dot-grid": {
        "path": "/brand/patterns/dot-grid.svg",
        "type": "background",
        "opacity": 0.1
      }
    }
  }
}
```

### FrameWrapper Component

```tsx
import { FrameWrapper } from '@/components/FrameWrapper';

<FrameWrapper
  asset="coral-arch"
  placement="top"
  fallback={null}  // Gracefully hide if asset fails
>
  <PageContent />
</FrameWrapper>
```

**Features**:
- Lazy loading (images loaded on demand)
- Retry logic (3 retries with exponential backoff)
- Feature flag gated (`VITE_FEATURE_VISUALS`)
- `aria-hidden="true"` (decorative only)

---

## Accessibility Guidelines

### Contrast Requirements (WCAG AA)

All text-background pairs must meet **4.5:1** minimum contrast ratio.

**Verified Pairs** (via `npm run check-contrast`):
- `--color-text-primary` on `--color-bg-primary` ’ 17.8:1 
- `--color-text-secondary` on `--color-bg-primary` ’ 8.2:1 
- `--color-text-tertiary` on `--color-surface` ’ 4.6:1 
- `--color-accent` on `--color-bg-primary` ’ 6.1:1 

### Focus States

All interactive elements must have visible focus indicators:

```css
button:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}
```

### Screen Reader Support

- Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Add `aria-label` for icon-only buttons
- Use `aria-hidden="true"` for decorative elements
- Provide text alternatives for images

---

## Responsive Breakpoints

```css
/* Mobile first (default) */
/* Styles here apply to all screens */

/* Tablet */
@media (min-width: 640px) {
  /* sm: small tablets */
}

@media (min-width: 768px) {
  /* md: tablets */
}

/* Desktop */
@media (min-width: 1024px) {
  /* lg: laptops */
}

@media (min-width: 1280px) {
  /* xl: desktops */
}

@media (min-width: 1536px) {
  /* 2xl: large monitors */
}
```

### Layout Patterns

**Mobile (< 768px)**:
- Single column
- Full-width cards
- Sidebar collapses to hamburger menu

**Tablet (768px - 1024px)**:
- Two-column grid
- Cards maintain padding
- Sidebar toggleable

**Desktop (> 1024px)**:
- Three-column grid (where applicable)
- Persistent sidebar
- Larger font sizes

---

## UX Guidelines

### Loading States

Always provide feedback during async operations:

```tsx
<button disabled={loading}>
  {loading ? 'Generating...' : 'Generate Quiz'}
</button>
```

Use skeleton screens for lists:

```tsx
{loading ? (
  <div className="skeleton-card" />
) : (
  <ClassCard data={classData} />
)}
```

### Error States

Display errors inline with helpful messages:

```tsx
{error && (
  <div className="error-banner">
    <Icon name="alert-circle" />
    <p>{error.message}</p>
  </div>
)}
```

### Empty States

Provide actionable guidance when no data:

```tsx
{notes.length === 0 && (
  <div className="empty-state">
    <Icon name="file-plus" />
    <h3>No notes yet</h3>
    <p>Add your first note to get started</p>
    <button onClick={openAddNoteDialog}>Add Note</button>
  </div>
)}
```

### Toast Notifications

Use for non-critical feedback:

```tsx
import { useToast } from '@/lib/toast';

const toast = useToast();

// Success
toast.push({ kind: 'success', text: 'Quiz generated!' });

// Error
toast.push({ kind: 'error', text: 'Failed to save note' });

// Info
toast.push({ kind: 'info', text: 'Autosaved' });
```

**Position**: Bottom-right
**Duration**: 4 seconds (dismissible)
**Max visible**: 3 at once

---

## Theme Presets

### Coral Leaf Dark (Default)

```css
:root {
  --color-accent: hsl(350, 85%, 55%);     /* Coral */
  --color-success: hsl(145, 70%, 45%);    /* Leaf */
  --color-bg-primary: hsl(217, 33%, 7%);  /* Dark */
  /* ... */
}
```

### Ocean Dark (Alternative)

```css
:root {
  --color-accent: hsl(210, 85%, 55%);     /* Ocean blue */
  --color-success: hsl(145, 70%, 45%);    /* Leaf */
  --color-bg-primary: hsl(217, 33%, 7%);  /* Dark */
  /* ... */
}
```

**Theme Picker** (Future):
- Feature flag: `VITE_FEATURE_THEME_PICKER`
- Persisted to LocalStorage
- Toggle in user settings

---

## Component Library (Future)

Planned components for design system consistency:

- [ ] Button (primary, secondary, ghost, danger)
- [ ] Input (text, textarea, number, select)
- [ ] Card (with variants)
- [ ] Modal (with variants)
- [ ] Toast (already implemented)
- [ ] Dropdown
- [ ] Tooltip
- [ ] Badge
- [ ] Spinner
- [ ] Skeleton
- [ ] Progress bar

---

## Development Guidelines

### Do's

 Use CSS custom properties for all values
 Use semantic color names (`--color-accent`, not `--color-red`)
 Test contrast ratios with `npm run check-contrast`
 Provide loading, error, and empty states
 Use motion sparingly and purposefully
 Test on mobile, tablet, and desktop
 Add `aria-label` for icon-only buttons

### Don'ts

L Never use inline hex colors (`background: '#EE4266'`)
L Never use magic numbers (`padding: 16px`)
L Never skip focus states
L Never use motion for motion's sake
L Never ignore WCAG AA contrast requirements
L Never assume desktop-only usage

---

## Tools & Scripts

### Contrast Checker

```bash
npm run check-contrast
```

Validates all token pairs meet WCAG AA (4.5:1 minimum).

**Output**:
```
 --color-text-primary on --color-bg-primary: 17.8:1
 --color-text-secondary on --color-bg-primary: 8.2:1
 --color-accent on --color-bg-primary: 6.1:1
...
 All 17 pairs pass WCAG AA (e4.5:1)
```

**Exit Code**: 0 if all pass, 1 if any fail

---

## Reference

- **Theme Tokens**: `web/src/theme-tokens.css`
- **Asset Manifest**: `web/src/brand/manifest.json`
- **FrameWrapper**: `web/src/components/FrameWrapper.tsx`
- **Contrast Script**: `scripts/check-contrast.ts`
- **Session Docs**: `docs/archive/sessions/session_11_section7_foundation.md`

---

**Last Updated**: November 18, 2025 (Section 7 Complete)
**CI Status**:  All 17 contrast checks passing
**Next**: Theme picker UI (Feature flag: VITE_FEATURE_THEME_PICKER)
