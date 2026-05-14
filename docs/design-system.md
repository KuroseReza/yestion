# Yestion UI Design System

## 1. Color Palette

### Amber (Brand / Primary)

| Shade | Hex | Usage |
|---|---|---|
| `amber-50` | `#FFFBEB` | Page bg, hover states, card tints |
| `amber-100` | `#FEF3C7` | Active nav buttons |
| `amber-500` | `#F59E0B` | Accent dot ring glow |
| `amber-600` | `#D97706` | Active tabs, links, buttons |
| `amber-700` | `#B45309` | Active titles, dark contrast |
| `amber-900` | `#78350F` | Border lines (at 10% opacity) |

### Stone (Neutral / Text)

| Shade | Usage |
|---|---|
| `stone-50` | High-contrast text in dark mode |
| `stone-200` | Body text dark mode |
| `stone-400` | Icons, muted labels |
| `stone-500` | Labels, meta text |
| `stone-700` | Note titles, body text |
| `stone-800` | Panel headers, emphasis |
| `stone-950` | Maximum contrast headings |

### Glass Panel Colors

| Mode | Background | Border | Shadow |
|---|---|---|---|
| Light | `rgba(255,255,255,0.58)` | `rgba(180,83,9,0.14)` | `rgba(120,53,15,0.10)` |
| Dark | `rgba(41,37,36,0.58)` | `rgba(255,255,255,0.10)` | `rgba(0,0,0,0.22)` |

### Background Gradients

**Light** — radial warm amber/orange spots over `#fffaf0 → #fff7ed → #fef3c7`  
**Dark** — radial deep orange/brown spots over `#1c1917 → #292524 → #120f0d`

---

## 2. Core Components

### Glass Panel
```
class="glass-panel rounded-2xl overflow-hidden"
```
Frosted glass: `backdrop-filter: blur(24px) saturate(165%)`, inner white highlight

### Glass Card (lighter variant)
```
class="glass-card backdrop-blur p-4 shadow-sm"
```
For sub-panels, dialogs: `blur(18px) saturate(150%)`

### Primary Button (`.btn-warm-primary`)
```
class="px-4 py-2 rounded-lg btn-warm-primary text-sm font-medium disabled:opacity-50"
```
Amber gradient `#d97706 → #f59e0b`, warm glow shadow

### Icon Buttons
```
class="p-2 rounded-md hover:bg-amber-50 dark:hover:bg-white/5 text-stone-400 transition-colors active:scale-90"
```

### Text Buttons
```
class="px-3 py-1.5 rounded-lg text-sm font-medium text-stone-600 dark:text-stone-300 hover:bg-amber-50/80 dark:hover:bg-white/5 transition-colors"
```

### Input Fields
```
class="w-full bg-white/70 dark:bg-stone-900/60 border border-amber-900/20 dark:border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
```

### Title Input (borderless, inline)
```
class="bg-transparent text-lg md:text-xl font-bold text-stone-950 dark:text-stone-50 outline-none"
```

### Select / Dropdown
```
class="rounded-lg border border-amber-900/10 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm text-stone-950 dark:text-stone-50"
```

### Dropdown Menu
```
class="absolute right-0 top-full mt-2 z-30 rounded-xl border border-amber-900/10 dark:border-white/10 bg-white/95 dark:bg-stone-950/95 backdrop-blur shadow-xl p-1 animate-panel-in"
```

### Error / Success Messages
```
class="p-3 text-sm rounded-md border border-red-500/50 bg-red-500/10 text-red-600"
class="p-3 text-sm rounded-md border border-emerald-500/50 bg-emerald-500/10 text-emerald-600"
```

### Loading Spinner
```
class="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-600 border-r-transparent"
```

### Zoom Overlay
```
class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
```

---

## 3. Border Conventions

```
Standard:    border border-amber-900/10 dark:border-white/10
Subtle:      border-amber-900/10 dark:border-white/5
Section:     border-b border-amber-900/10 dark:border-white/5
Dashed:      border border-dashed border-amber-900/20 dark:border-white/15
Transparent: border border-transparent
```

---

## 4. Animations

| Class | Duration | Effect |
|---|---|---|
| `animate-fade-in` | 250ms | Opacity 0→1 |
| `animate-panel-in` | 200ms | Scale 0.97→1 + slide up + fade |
| `animate-list-in` | 300ms | Slide from left + fade (staggered) |
| `animate-page-enter` | 250ms | Slide up 6px + fade |
| `animate-image-in` | 400ms | Scale 0.96→1 + fade |
| `active:scale-90` | — | Icon buttons on press |
| `transition-colors` | 150ms | All interactive elements |

---

## 5. Layout Patterns

### Two-Column (Sidebar + Content)
```
<div class="flex h-full overflow-hidden p-3 md:p-4 gap-3">
  <div class="w-full md:w-64 shrink-0 glass-panel rounded-2xl overflow-hidden"><!-- sidebar --></div>
  <div class="flex-1 glass-panel rounded-2xl overflow-hidden"><!-- content --></div>
</div>
```

### Page Sections
```
px-4 h-14             — panel header
px-3 py-2.5           — list item
p-4 md:p-8            — editor area
p-5 sm:p-8 md:p-12    — article panel
gap-1 sm:gap-2        — inline button row
space-y-2 / space-y-4 — vertical stack
```

### Responsive
```
mobile: stacked, hidden desktop elements
sm (640px): inline buttons, grid columns
md (768px): sidebar + content side-by-side
max-w-4xl (896px): share/about/article
max-w-6xl (1152px): settings/api docs
```

---

## 6. Typography

**Font**: `Inter, ui-sans-serif, system-ui, sans-serif`  
**Mono**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

| Size | Class | Usage |
|---|---|---|
| 11px | `text-[11px]` | Date labels, badges |
| 12px | `text-xs` | Hints, meta text |
| 14px | `text-sm` | Body, buttons, labels |
| 16px | `text-base` | Default body |
| 18px | `text-lg` | Section headings |
| 20px | `text-xl` | Sidebar headings |
| 24px | `text-2xl` | Login heading, API section |
| 30px | `text-3xl` | Page titles |

**Weights**: `font-medium` (buttons), `font-semibold` (labels), `font-bold` (headings)

---

## 7. Dark Mode

```css
@custom-variant dark (&:is(.dark *));
```

Toggle sets `.dark` on `<html>`, uses `dark:` prefix everywhere.

**Key patterns**:
- Backgrounds: `dark:bg-white/10`, `dark:bg-black/20`, `dark:bg-stone-900/60`
- Borders: `dark:border-white/10`, `dark:border-white/5`
- Text: `dark:text-stone-50` (high contrast), `dark:text-stone-400` (muted)
- Hover: `dark:hover:bg-white/5`

**Implementation**: inline `<script>` in `index.html` reads `localStorage.theme` before JS bundle loads (prevents flash).

---

## 8. Scrollbar

```css
.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(180,83,9,0.20); border-radius: 8px }
```
