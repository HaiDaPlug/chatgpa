Perfect choice. 🌿
Option B (Hybrid Voice + Coral-Green Palette) gives you the **warmth of the sapling metaphor** without forcing it linguistically — and coral-green is visually striking *and* gender-neutral, great for education.

Here’s your **brand kit v0.1 – Coral × Leaf Hybrid** ready to drop into the repo.

---

## 🎨 1) Color Palette (finalized)

| Role                 | HEX       | Tailwind ref | Notes              |
| -------------------- | --------- | ------------ | ------------------ |
| **Primary / Growth** | `#34D399` | green-400    | sapling/leaf tone  |
| **Accent / Energy**  | `#FB7185` | rose-400     | coral warmth       |
| **Background**       | `#0B0B0C` | stone-950    | dark academic feel |
| **Surface**          | `#1C1C1F` | stone-900    | card bg            |
| **Text**             | `#F3F4F6` | stone-100    | clean contrast     |
| **Success**          | `#10B981` | green-500    | correct answers    |
| **Warning**          | `#F59E0B` | amber-500    | weak areas         |
| **Error**            | `#EF4444` | red-500      | failed actions     |

### Tailwind tokens

```ts
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      brand: "#34D399",
      accent: "#FB7185",
      surface: "#1C1C1F",
      bg: "#0B0B0C",
      text: "#F3F4F6",
      success: "#10B981",
      warn: "#F59E0B",
      error: "#EF4444",
    },
    borderRadius: { xl: "1rem", "2xl": "1.25rem" },
    boxShadow: { soft: "0 6px 20px rgba(0,0,0,0.25)" },
  },
},
```

---

## 🖋️ 2) Typography

* **Display / Headings:** `Clash Display` (Alt: Recoleta / Poppins SemiBold)
* **Body / UI:** `Inter` or `Satoshi`

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Clash+Display:wght@500;600&display=swap');
```

Usage guideline:

* Titles (e.g. “Your Dashboard”) → Clash Display 600
* Paragraphs/buttons → Inter 500
* Letter spacing +0.01em for warmth.

---

## 🌱 3) Visual Motif (Hybrid use)

* **Metaphor stays visual** → use sapling/tree icons, progress ring, and growth animation.
* **Copy stays clean** → “Grow your knowledge”, not “Water your sapling.”
* **Sapling mark:** use the SVG we built earlier (`/public/brand/sapling.svg`).
* Keep subtle pulse animation when progress increases (+coral highlight).

---

## 🪄 4) Sample Component Tokens

```tsx
// src/components/ui/Button.tsx
export function Button({ className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-2 font-medium text-text bg-brand hover:bg-accent transition-colors shadow-soft ${className}`}
    />
  );
}
```

Coral hover gives instant energy on the dark leaf base.

---

## 🌿 5) Copy Tone Examples (Hybrid voice)

| Context               | Example                                                                             |
| --------------------- | ----------------------------------------------------------------------------------- |
| Landing header        | “Study that grows with you.”                                                        |
| CTA                   | “Start learning” / “Generate quiz”                                                  |
| Dashboard empty state | “Create your first class to start growing your knowledge.” *(sapling icon visible)* |
| Toast success         | “Quiz completed! +4% progress.”                                                     |
| Upgrade limit         | “Free plan: 1 class · 5 quizzes · Upgrade anytime.”                                 |

---

## ⚙️ 6) Next Brand Tasks

* [ ] Add **theme.css** with these colors (import in `main.tsx`).
* [ ] Update Tailwind config tokens.
* [ ] Replace button/card colors across app.
* [ ] Add **sapling.svg** to logo + favicon.
* [ ] Apply **font imports** and update typography in global CSS.
* [ ] Create header progress badge (sapling + stage + % ring).

---

Would you like me to generate that **Header Tree Badge** component next (it shows the sapling + progress ring + current stage label)? It’s a perfect way to visualize “growth without over-speaking it.”
