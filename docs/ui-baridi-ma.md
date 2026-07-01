# UI Foundation: Baridi.ma
**UX Reference**: docs/ux-baridi-ma.md
**Version**: 1.0 | **Date**: 2026-07-01 | **Author**: UI Designer

## 1. Design Approach
- **Strategy**: Tailwind v4 utility classes + shadcn/ui component primitives (accessible, unstyled Radix-based components styled with Tailwind)
- **Rationale**: Tailwind already committed in the stack (README). shadcn/ui avoids building form controls, dialogs, and charts from scratch — YAGNI says use a framework unless brand requires fully custom, and a pilot/MVP product doesn't need custom componentry yet.

## 2. Design Tokens
```css
/* Colors — status-driven palette, since the core UX is "is this shipment OK?" */
--color-primary:      #0F766E; /* teal — cold-chain/trust association */
--color-secondary:    #1E3A5F; /* deep blue */
--color-background:   #F8FAFC;
--color-surface:      #FFFFFF;
--color-success:      #16A34A; /* within threshold */
--color-warning:      #D97706; /* nearing threshold */
--color-error:        #DC2626; /* excursion/alert */
--color-text:         #0F172A;
--color-text-muted:   #64748B;

/* Typography */
--font-family:   'Inter', system-ui, sans-serif;
--font-size-sm:  0.875rem;
--font-size-md:  1rem;
--font-size-lg:  1.25rem;
--font-size-xl:  1.75rem;

/* Spacing scale (Tailwind default scale used directly — no override needed) */
```

## 3. Component Inventory
| Component | Reuse Existing | Build New | Notes |
|---|---|---|---|
| Button | shadcn/ui Button | No | primary / secondary / destructive variants |
| Form inputs (text, select, date) | shadcn/ui | No | used in shipment creation form |
| Data table | shadcn/ui Table | No | shipments list, alerts list |
| Status badge | — | Yes | small component: created/in_transit/delivered/cancelled + alert severity colors |
| Live temp/humidity chart | — | Yes (using Recharts) | line chart, threshold band overlay |
| Toast/notification | shadcn/ui Toast | No | alert notifications, form success/error |
| Dialog/modal | shadcn/ui Dialog | No | confirm actions (assign carrier, cancel shipment) |
| PDF export button + loading state | — | Yes | thin wrapper, calls Compliance Service, shows spinner |

## 4. Responsive Breakpoints
| Breakpoint | Width | Layout Notes |
|---|---|---|
| Mobile | < 768px | Single-column; shipment list as cards, not table; carrier persona is primarily mobile (in-truck use) |
| Tablet | 768–1024px | Two-column where space allows (e.g. shipment detail: chart + info side-by-side) |
| Desktop | > 1024px | Full table views for Admin/Shipper; sidebar nav |

## 5. Accessibility Baseline
- Color contrast: AA minimum (4.5:1 normal text, 3:1 large text) — status colors chosen and verified against white/light backgrounds
- Focus indicators: visible on all interactive elements (shadcn/ui defaults preserve this — do not override with `outline-none` without a replacement focus style)
- Semantic HTML first; ARIA only where native semantics insufficient (e.g. live-updating chart region gets `aria-live="polite"` for alert state changes)
- Status conveyed by more than color alone (icon + text label alongside every status badge, since color-blind users must distinguish "normal" from "alert")
