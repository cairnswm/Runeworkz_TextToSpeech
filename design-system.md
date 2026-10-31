626f6c742d63632d6167656e74Here is the design system for this application:

---

## Design System

### Color Palette
**Primary — Orange** (actions, icons, active states)
- `orange-400` hover, `orange-500` default, `orange-600` pressed
- Dark mode: shift one step lighter (`orange-400`)

**Neutrals — Slate** (all backgrounds, text, borders)
- Backgrounds: `white` / `slate-50` → dark: `slate-900` / `slate-950`
- Surfaces: `slate-100` → dark: `slate-800`
- Borders: `slate-200` → dark: `slate-700`
- Secondary text: `slate-500` → dark: `slate-400`
- Body text: `slate-700/800` → dark: `slate-200/white`

**Status Colors**
| State | Light | Dark |
|---|---|---|
| Success | `green-600`, `green-50`, `green-200` border | `green-400`, `green-900/20`, `green-800` border |
| Pending | `amber-600`, `amber-50`, `amber-200` border | `amber-400`, `amber-900/20`, `amber-800` border |
| Uploading | `blue-600`, `blue-50`, `blue-200` border | `blue-400`, `blue-900/20`, `blue-800` border |
| Error | `red-600`, `red-50`, `red-200` border | `red-400`, `red-900/20`, `red-800` border |

---

### Typography
- **Font**: Inter, system-ui fallback; antialiased
- **Sizes**: `text-xs` (labels/badges) → `text-sm` (body) → `text-base` → `text-xl` (stat numbers) → `text-2xl` (page titles) → `text-4xl–6xl` (hero)
- **Weights**: regular 400, medium 500, semibold 600, bold 700 — maximum 3 per screen
- **Tracking**: `tracking-tight` on logotype, `tracking-wide` on uppercase section labels

---

### Spacing
Base grid: **8px (Tailwind spacing-2)**. All padding, gap, and margin values are multiples of this.

Common patterns:
- Card padding: `px-4 py-3`
- Button padding: `px-4 py-2.5` (medium), `px-2.5 py-1.5` (small)
- Section gaps: `gap-3` (stat grid), `gap-4` (card grid)
- Page container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

---

### Border Radius
| Token | Use |
|---|---|
| `rounded-full` | Inline badges, pills, status dots, avatar rings |
| `rounded-lg` | Small buttons, inputs, table cells |
| `rounded-xl` | Primary buttons, banners, dropdowns, stat cards |
| `rounded-2xl` | Entry cards, modals |
| `rounded-3xl` | Large icon containers (empty states) |

---

### Component Patterns

**Buttons**
- Primary: `bg-orange-500 hover:bg-orange-400 text-white rounded-xl px-4 py-2.5 text-sm font-medium active:scale-95 hover:shadow-lg hover:shadow-orange-500/20`
- Ghost/text: `text-slate-500 hover:text-slate-700` + icon
- Destructive: `bg-red-500 hover:bg-red-400 text-white rounded-lg`
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed`

**Cards**: `bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow`

**Badges/Pills**: `inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border` + status color set

**Dropdowns**: `bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg animate-slide-down`

---

### Icons
**Lucide React** exclusively. Sizes: `w-3` (inline), `w-3.5` (small UI), `w-4` (standard), `w-6` (nav), `w-10` (empty states).

---

### Animations
Custom keyframes defined in `tailwind.config.js`:
- `animate-fade-in` — opacity 0→1, 0.3s ease-in-out
- `animate-slide-down` — translateY(-10px)+opacity 0 → 0+1, 0.3s ease-out (dropdowns)
- `animate-slide-up` — translateY(+10px)+opacity 0 → 0+1, 0.3s ease-out
- `animate-pulse-slow` — standard pulse at 3s cycle (status dots, loading hints)
- `animate-spin` — Lucide `Loader` icon during active uploads

All interactive elements use `transition-colors` or `transition-all duration-200`.

---

### Dark Mode
Class-based (`darkMode: 'class'`), toggled via `ThemeContext` applied to the `<html>` element. Every color token has a paired `dark:` variant. The pattern is: lighter shades in light mode, one step lighter in dark mode for the same visual weight.
