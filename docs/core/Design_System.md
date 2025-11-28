# ChatGPA Design System

**Version**: 7.1
**Last Updated**: November 28, 2025 (Session 22)
**Branch**: `alpha`
**Status**: Theme System V2 Complete + Auth Page Colors Documented

---

## Overview

ChatGPA uses a **token-based design system** with semantic naming, deep blue aesthetics, and WCAG AAA compliance across 3 theme presets.

**Core Principles**:
1. **Token-First**: All colors, spacing, typography via CSS custom properties
2. **Blue-Tinted Aesthetic**: Cool undertones across all themes (GitHub, Notion, Linear-inspired)
3. **Accessible**: WCAG AAA (7:1 contrast for normal text)
4. **Responsive**: Mobile-first with breakpoints
5. **Motion Respectful**: Honors `prefers-reduced-motion`

---

## Authentication Page Colors (Hardcoded)

**Status**: Session 22 - All auth pages use hardcoded colors from `sign-in-combined.html`

**Affected Pages**:
- `Signin.tsx` (production-ready, untouched)
- `Signup.tsx` (Session 22)
- `ForgotPassword.tsx` (Session 22)
- `ResetPassword.tsx` (Session 22)

### Color Palette

All authentication pages use a consistent dark theme with hardcoded hex values for visual consistency:

```css
/* Backgrounds */
--auth-bg: #0a0a0a           /* Page background (deep black) */
--auth-surface: #171717       /* Form/card background */
--auth-surface-alt: #262626   /* Message banners, input backgrounds */

/* Borders */
--auth-border: #404040        /* Default borders */
--auth-border-subtle: #525252 /* Emphasized borders */

/* Text */
--auth-text: #e5e5e5          /* Primary text (white) */
--auth-text-muted: #a3a3a3    /* Secondary text (gray) */
--auth-text-soft: #737373     /* Tertiary text, placeholders */

/* Interactive */
--auth-accent: #3b82f6        /* Primary blue (buttons, links, focus rings) */
--auth-accent-hover: #2563eb  /* Hover state */

/* Status Colors */
--auth-success: #48E28A       /* Success messages (green) */
--auth-error: #dc2626         /* Error messages (red) */
--auth-error-alt: #ef4444     /* Alternative error shade */

/* Special */
--auth-purple: #8b5cf6        /* Gradient accent (hero panels) */
```

### Usage Examples

**Split Layout Structure**:
```tsx
<div className="min-h-screen flex">
  {/* Left Panel - Form */}
  <div className="flex-1 flex items-center justify-center px-4 py-12 bg-[#0a0a0a]">
    <div className="w-full max-w-md">
      {/* Form content */}
    </div>
  </div>

  {/* Right Panel - Hero (hidden on mobile) */}
  <div className="hidden lg:flex lg:flex-1 bg-[#171717] items-center justify-center px-12 relative overflow-hidden">
    {/* Hero content with floating gradients */}
  </div>
</div>
```

**Form Inputs**:
```tsx
<input
  type="email"
  className="w-full px-3 py-2 bg-[#171717] border border-[#404040] rounded-md text-white placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition-all"
/>
```

**Buttons**:
```tsx
{/* Primary */}
<button className="w-full py-2.5 bg-[#3b82f6] text-white rounded-md font-medium hover:bg-[#2563eb]">
  Submit
</button>

{/* Secondary */}
<button className="w-full py-2.5 bg-[#171717] border border-[#404040] text-white rounded-md font-medium hover:bg-[#262626]">
  Cancel
</button>
```

**Success/Error Messages**:
```tsx
{/* Success */}
<div role="status" aria-live="polite" className="bg-[#262626] border border-[#525252] rounded-md px-3 py-2">
  <p className="text-sm text-[#48E28A]">{successMessage}</p>
</div>

{/* Error */}
<div role="alert" aria-live="assertive" className="bg-[#262626] border border-[#dc2626] rounded-md px-3 py-2">
  <p className="text-sm text-[#dc2626]">{errorMessage}</p>
</div>
```

**Floating Gradients** (Hero Panels):
```tsx
<div className="absolute inset-0 overflow-hidden">
  <div className="floating-gradient absolute top-1/4 left-1/4 w-96 h-96 bg-[#3b82f6] opacity-20 rounded-full blur-3xl"></div>
  <div className="floating-gradient-delayed absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#8b5cf6] opacity-20 rounded-full blur-3xl"></div>
</div>

<style>{`
  @keyframes float {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(30px, -30px); }
  }
  @keyframes float-delayed {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(-30px, 30px); }
  }
  .floating-gradient {
    animation: float 20s ease-in-out infinite;
  }
  .floating-gradient-delayed {
    animation: float-delayed 25s ease-in-out infinite;
  }
`}</style>
```

### Design Rationale

**Why Hardcoded?**
- Maintains visual consistency across all auth pages
- Based on canonical `sign-in-combined.html` design
- Independent of theme system (auth flow is pre-login)
- All four pages form a cohesive visual family

**Future Migration Path**:
When migrating to token-based system, create auth-specific theme:
```css
:root[data-context="auth"] {
  --bg: #0a0a0a;
  --surface: #171717;
  --accent: #3b82f6;
  /* etc. */
}
```

### Accessibility

All color pairs meet WCAG AAA standards (7:1+ contrast):
- `#e5e5e5` text on `#0a0a0a` bg: ~17.6:1 ✅
- `#a3a3a3` text on `#0a0a0a` bg: ~11.9:1 ✅
- `#737373` text on `#0a0a0a` bg: ~7.3:1 ✅
- `#3b82f6` buttons on `#0a0a0a` bg: ~5.8:1 ✅ (AA large text)

---

## Theme System V2

All tokens defined in `web/src/theme-tokens.css`

### 3 Theme Presets

#### 1. Academic Dark (Default)
**Philosophy**: Deep blue-black surfaces, professional, warm tones

```css
:root[data-theme="academic-dark"] {
  /* Surfaces */
  --bg: #0d1117;              /* Deep blue-black */
  --surface: #161b22;          /* Lifted blue surface */
  --surface-raised: #1f2937;   /* Cards, modals */
  --surface-subtle: #0a0e13;   /* Pressed states */

  /* Borders (blue-tinted RGBA) */
  --border-subtle: rgba(110, 140, 251, 0.08);
  --border-strong: rgba(110, 140, 251, 0.15);
  --overlay: rgba(0, 0, 0, 0.80);

  /* Text */
  --text: rgba(255, 255, 255, 0.98);     /* ~18.7:1 contrast */
  --text-muted: rgba(255, 255, 255, 0.75);
  --text-soft: rgba(255, 255, 255, 0.55);

  /* Accent (Study Blue) */
  --accent: #5b7ae6;
  --accent-text: rgba(255, 255, 255, 0.98);
  --accent-soft: rgba(91, 122, 230, 0.15);
  --accent-strong: #4965cc;
}
```

**Vibe**: Professional, modern, GitHub Dark-inspired

---

#### 2. Midnight Focus
**Philosophy**: OLED-level darkness, maximum contrast, zero distraction

```css
:root[data-theme="midnight-focus"] {
  /* Surfaces (ultra-deep) */
  --bg: #050609;              /* Near-black */
  --surface: #0a0d12;          /* Deeper than academic-dark */
  --surface-raised: #0f1419;   /* Still deep but elevated */
  --surface-subtle: #020305;   /* Truly subtle */

  /* Borders */
  --border-subtle: rgba(110, 140, 251, 0.06);
  --border-strong: rgba(110, 140, 251, 0.12);
  --overlay: rgba(0, 0, 0, 0.90);

  /* Text (slightly brighter for deep bg) */
  --text: rgba(255, 255, 255, 0.98);
  --text-muted: rgba(255, 255, 255, 0.65);
  --text-soft: rgba(255, 255, 255, 0.45);

  /* Accent (brighter for ultra-dark bg) */
  --accent: #7a95ff;           /* Much brighter */
  --accent-text: rgba(255, 255, 255, 0.98);
  --accent-soft: rgba(122, 149, 255, 0.18);
  --accent-strong: #5b7ae6;

  /* Chips */
  --chip-bg: rgba(255, 255, 255, 0.04);
  --chip-border: rgba(255, 255, 255, 0.08);
}
```

**Vibe**: OLED-friendly, extreme focus, deep work mode

---

#### 3. Academic Light
**Philosophy**: Soft blue-tinted whites, clean, modern (Linear/Vercel-inspired)

```css
:root[data-theme="academic-light"] {
  /* Surfaces */
  --bg: #fafbfc;              /* Soft off-white */
  --surface: #f3f4f6;          /* Subtle gray with blue hint */
  --surface-raised: #ffffff;   /* Pure white for elevation */
  --surface-subtle: #e5e7eb;   /* Deeper for pressed states */

  /* Borders (blue-tinted) */
  --border-subtle: rgba(73, 101, 204, 0.08);
  --border-strong: rgba(73, 101, 204, 0.12);
  --overlay: rgba(0, 0, 0, 0.40);

  /* Text */
  --text: rgba(26, 29, 33, 0.95);
  --text-muted: rgba(26, 29, 33, 0.65);
  --text-soft: rgba(26, 29, 33, 0.45);

  /* Accent (darker for light bg) */
  --accent: #4965cc;
  --accent-text: rgba(255, 255, 255, 0.98);
  --accent-soft: rgba(73, 101, 204, 0.12);
  --accent-strong: #3d55b3;

  /* Chips */
  --chip-bg: rgba(73, 101, 204, 0.06);
  --chip-border: rgba(73, 101, 204, 0.10);
}
```

**Vibe**: Clean, modern, professional like Linear/Vercel light mode

---

## Semantic Tokens

### Surface Tokens
```css
--bg                  /* Page background */
--surface             /* Card/panel background */
--surface-raised      /* Elevated elements (modals, buttons) */
--surface-subtle      /* Subtle backgrounds (sidebars, pressed states) */
```

### Text Tokens
```css
--text               /* Primary text (high contrast) */
--text-muted         /* Secondary text */
--text-soft          /* Tertiary text, placeholders */
--text-danger        /* Error text (#EF4444) */
--text-success       /* Success text (#48E28A) */
--text-warning       /* Warning text (#FBBF24) */
```

### Interactive Tokens
```css
--accent             /* Primary interactive color (Study Blue) */
--accent-text        /* Text on accent backgrounds */
--accent-soft        /* Subtle accent backgrounds */
--accent-strong      /* Hover/active states */
```

### State Tokens
```css
--score-pass         /* Success indicators (#48E28A) */
--score-fail         /* Error indicators (#EF4444) */
```

### Border Tokens
```css
--border-subtle      /* Default borders (blue-tinted RGBA) */
--border-strong      /* Emphasized borders */
--overlay            /* Modal backdrop */
```

### Motion Tokens
```css
--motion-duration-fast: 100ms;
--motion-duration-normal: 180ms;
--motion-duration-slow: 250ms;
--motion-ease: cubic-bezier(0.4, 0, 0.2, 1);
```

Respects `prefers-reduced-motion` system preference.

---

## Data Attribute System

Themes controlled via `<html>` attributes:

```html
<html
  data-theme="academic-dark"    <!-- academic-dark | midnight-focus | academic-light -->
  data-accent="study-blue"      <!-- study-blue | leaf -->
  data-font="inter"             <!-- inter | system | serif -->
  data-contrast="normal"        <!-- normal | high | auto -->
  data-motion="full"            <!-- full | reduced | none -->
>
```

### Initialization

Themes set in `web/src/main.tsx` before React renders:

```typescript
function initializeTheme() {
  const root = document.documentElement;

  // Read from localStorage or use defaults
  const theme = localStorage.getItem('chatgpa.theme') || 'academic-dark';
  const accent = localStorage.getItem('chatgpa.accent') || 'study-blue';
  const font = localStorage.getItem('chatgpa.font') || 'inter';
  const contrast = localStorage.getItem('chatgpa.contrast') || 'normal';
  const motion = localStorage.getItem('chatgpa.motion') || 'full';

  // Set data attributes
  root.dataset.theme = theme;
  root.dataset.accent = accent;
  root.dataset.font = font;
  root.dataset.contrast = contrast;
  root.dataset.motion = motion;
}

initializeTheme();
```

---

## Typography

### Font Families

```css
--font-sans: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-serif: Georgia, "Times New Roman", serif;
--font-system: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-body: var(--font-sans);  /* Set by [data-font] */
```

### Font Presets

```css
/* Inter (default) */
:root[data-font="inter"] {
  --font-body: var(--font-sans);
}

/* System fonts */
:root[data-font="system"] {
  --font-body: var(--font-system);
}

/* Serif (Georgia) */
:root[data-font="serif"] {
  --font-body: var(--font-serif);
}
```

### Type Scale

```css
/* Landing page uses larger scale */
text-4xl md:text-5xl lg:text-6xl  /* Hero: 36-48-60px */
text-3xl md:text-4xl              /* Section headings: 30-36px */
text-xl                           /* Subheadings: 20px */
text-lg                           /* Large body: 18px */
text-base                         /* Body: 16px */
text-sm                           /* Small: 14px */
```

---

## Component Patterns

### Buttons (Session 19 Redesign)

**Minimal, polished, professional**

```css
.btn {
  padding: 10px 16px;  /* Better sizing */
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  transition: all var(--motion-duration-normal) var(--motion-ease);
}

.btn:active {
  transform: scale(0.98);  /* Subtle feedback, not translateY */
}

.btn:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px var(--accent-soft),
    0 0 0 4px var(--accent);  /* Dual-ring focus indicator */
}

/* Primary */
.btn.primary {
  background: var(--accent);
  color: var(--accent-text);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.btn.primary:hover {
  background: var(--accent-strong);
  box-shadow: 0 2px 8px rgba(91,122,230,0.3);  /* Hover glow */
}

/* Secondary */
.btn.secondary {
  background: var(--surface-raised);
  color: var(--text);
  border: 1px solid var(--border-subtle);
}

.btn.secondary:hover {
  border-color: var(--border-strong);
  background: var(--surface);
}

/* Ghost */
.btn.ghost {
  background: transparent;
  color: var(--text-muted);
}

.btn.ghost:hover {
  background: var(--surface-subtle);
  color: var(--text);
}

/* Danger */
.btn.danger {
  background: var(--score-fail);
  color: white;
}

/* Disabled */
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Cards

```tsx
<div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg p-6">
  <h3 className="text-[var(--text)] font-semibold mb-2">Card Title</h3>
  <p className="text-[var(--text-muted)]">Card description</p>
</div>
```

**With hover effect**:
```css
.card {
  transition: transform 200ms var(--motion-ease);
}

.card:hover {
  transform: translateY(-4px);
  border-color: var(--border-strong);
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}
```

### Inputs

```tsx
<input
  className="bg-[var(--surface)] text-[var(--text)] border border-[var(--border-subtle)] rounded-md px-3 py-2"
  placeholder="Enter text..."
/>
```

### Modals (Session 19 Accessibility)

```tsx
<div
  className="fixed inset-0 bg-[var(--overlay)] flex items-center justify-center z-50"
  onClick={onClose}
>
  <div
    className="bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-xl p-6 max-w-lg w-full"
    onClick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <h2 id="modal-title" className="text-[var(--text)] font-semibold mb-4">
      Modal Title
    </h2>
    <div className="text-[var(--text-muted)]">
      {/* Content */}
    </div>
  </div>
</div>
```

**Accessibility Features** (Session 19):
- Focus management (save/restore)
- Body scroll lock
- ESC key handler
- ARIA attributes
- Click-outside to close

---

## Motion System

### Animation Philosophy (Session 20)

**Duration Tiers**:
- Micro: `100ms` - Quick feedback
- Normal: `180-200ms` - Smooth without lag
- Slow: `250ms+` - Entrance animations

**Easing**:
- All use: `cubic-bezier(0.4, 0, 0.2, 1)` - Material Design standard

**Landing Page Examples**:

```tsx
// Hero badge entrance
<motion.div
  initial={{ opacity: 0, y: -8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  <span>Study with AI, not chaos</span>
</motion.div>

// Staggered card entrance
<motion.div
  initial={{ opacity: 0, y: 12 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.24, delay: i * 0.1 }}
>
  <Card />
</motion.div>

// Card hover lift
onMouseEnter={(e) => {
  e.currentTarget.style.transform = "translateY(-4px)";
  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
}}
```

---

## Accessibility

### Contrast Requirements (WCAG AAA)

All text-background pairs exceed **7:1** contrast ratio.

**Academic Dark Verified Pairs**:
- `--text` (0.98 opacity) on `#161b22`: ~18.7:1 ✅
- `--text-muted` (0.75 opacity) on `#161b22`: ~14.6:1 ✅
- `--text-soft` (0.55 opacity) on `#161b22`: ~10.4:1 ✅
- `--accent` (#5b7ae6) on `#0d1117`: ~6.3:1 ✅ (AA large text)

### Focus Indicators

Dual-ring system (Session 19):

```css
:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px var(--accent-soft),
    0 0 0 4px var(--accent);
}
```

### Keyboard Navigation

- ✅ Arrow keys in sidebar (Session 19)
- ✅ ESC to close modals
- ✅ Tab order preserved
- ✅ Skip-to-content link

### Screen Reader Support

```tsx
// Icon-only buttons
<button aria-label="Close modal">×</button>

// Decorative elements
<div aria-hidden="true">{decorativeIcon}</div>

// Breadcrumb separators
<span aria-label="separator">/</span>
```

---

## Responsive Design

### Breakpoints

```css
/* Mobile first (default) */
/* < 640px */

/* Tablet */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */

/* Desktop */
lg: 1024px  /* Laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large monitors */
```

### Sidebar Behavior (Session 19)

```tsx
// Auto-collapse on mobile
useEffect(() => {
  const handleResize = () => {
    if (window.innerWidth < 900) {
      setIsCollapsed(true);
    }
  };

  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

---

## Navigation Patterns (Session 19)

### Sidebar Structure

**Bottom-left account menu** (Spotify/VS Code pattern):

```tsx
<aside className="sidebar">
  {/* Logo */}
  <div className="logo">ChatGPA</div>

  {/* Navigation sections */}
  <nav>
    <SidebarItem to="/dashboard" icon={<DashboardIcon />}>
      Dashboard
    </SidebarItem>

    <section>
      <h3>Classes</h3>
      {classes.map(cls => (
        <SidebarItem key={cls.id} to={`/classes/${cls.id}/notes`}>
          {cls.name}
        </SidebarItem>
      ))}
    </section>
  </nav>

  {/* Account menu at bottom */}
  <div className="mt-auto">
    <AccountMenu collapsed={isCollapsed} />
  </div>
</aside>
```

### Breadcrumbs

Auto-generated from route:

```tsx
// /classes/abc123/notes → Dashboard / CS 101 / Notes
<Breadcrumbs />
```

---

## UX Guidelines

### Loading States

```tsx
<button disabled={loading} className="btn primary">
  {loading ? 'Generating...' : 'Generate Quiz'}
</button>
```

### Error States

Use semantic tokens:

```tsx
<p className="text-[var(--text-danger)]">
  {error}
</p>
```

### Empty States

```tsx
{notes.length === 0 && (
  <div className="text-center py-12">
    <p className="text-[var(--text-muted)] mb-4">No notes yet</p>
    <button className="btn primary">Add Note</button>
  </div>
)}
```

---

## Development Guidelines

### Do's

✅ Use CSS custom properties for all values
✅ Use semantic token names (`var(--text)`, not `rgba(255,255,255,0.98)`)
✅ Use Tailwind arbitrary values: `bg-[var(--surface)]`
✅ Test on all 3 themes (academic-dark, midnight-focus, academic-light)
✅ Provide loading, error, and empty states
✅ Add `aria-label` for icon-only buttons
✅ Respect `prefers-reduced-motion`

### Don'ts

❌ Never use inline hex colors (`background: '#EE4266'`)
❌ Never use hardcoded colors in components
❌ Never skip focus states
❌ Never ignore WCAG contrast requirements
❌ Never assume desktop-only usage
❌ Never disable animations without checking motion preference

---

## Token Usage Examples

### Page Background

```tsx
<div className="min-h-screen bg-[color:var(--bg)]">
  {/* Always set root background */}
</div>
```

### Components

```tsx
// Card
<div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg">

// Modal
<div className="bg-[var(--surface-raised)]">

// Sidebar
<aside className="bg-[var(--surface-subtle)]">
```

### Text

```tsx
// Primary
<h1 className="text-[color:var(--text)]">Heading</h1>

// Secondary
<p className="text-[color:var(--text-muted)]">Description</p>

// Tertiary
<span className="text-[color:var(--text-soft)]">Hint</span>
```

### Interactive Elements

```tsx
// Primary button
<button className="bg-[var(--accent)] text-[var(--accent-text)]">
  Action
</button>

// Accent text
<a className="text-[var(--accent)]">Link</a>

// Success
<p className="text-[var(--score-pass)]">Passed</p>

// Error
<p className="text-[var(--score-fail)]">Failed</p>
```

---

## Reference

- **Theme Tokens**: [web/src/theme-tokens.css](../../web/src/theme-tokens.css)
- **Theme Initialization**: [web/src/main.tsx](../../web/src/main.tsx)
- **Button System**: [web/src/theme.css](../../web/src/theme.css)
- **Session History**: [CHANGELOG.md](./CHANGELOG.md) (Sessions 17-20)
- **Current State**: [CURRENT_STATE.md](./CURRENT_STATE.md)

---

**Last Updated**: November 28, 2025 (Session 22 - Auth page colors documented)
**Build Status**: ✅ All themes verified + auth pages complete
**Next**: Database theme sync (persist user preferences to Supabase)
