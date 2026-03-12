---
name: gtk4-css-theming
description: >
  Use when styling widgets, writing inline CSS, changing colors, modifying theme,
  or debugging visual issues. GTK4 CSS differs significantly from web CSS — many
  common web properties do NOT exist. Triggers on "style widget", "change colors",
  "update CSS", "theme", "fix styling", or visual issues with widgets.
---

# GTK4 CSS Theming

GTK4 CSS is a subset of web CSS with GTK-specific extensions. LLMs frequently
hallucinate web CSS properties that do not work in GTK4.

## Supported Properties

These properties work in GTK4 CSS:

**Layout:** `margin`, `padding`, `min-width`, `min-height`
**Colors:** `background`, `background-color`, `color`, `opacity`
**Borders:** `border`, `border-color`, `border-width`, `border-style`, `border-radius`
**Typography:** `font-family`, `font-size`, `font-weight`, `font-style`, `letter-spacing`
**Effects:** `transition` (property, duration, timing-function), `animation`, `@keyframes`
**Icons:** `-gtk-icon-size`, `-gtk-icon-style`

## NOT Supported (Do NOT Use)

These common web CSS properties **do not exist** in GTK4:

- `display` (flex, grid, block, none) — layout controlled by widget type (Box, CenterBox)
- `position` (absolute, relative, fixed) — use layer shell anchoring
- `flex`, `flex-direction`, `flex-grow` — use `hexpand`/`vexpand` widget properties
- `grid`, `grid-template-*` — use Grid widget
- `z-index` — stacking controlled by layer shell
- `box-shadow` — not supported
- `text-align` — use `halign` widget property
- `overflow` — not supported
- `transform` — not supported (except in `@keyframes`)
- `width`, `height` — use `min-width`, `min-height` instead
- `cursor` — not supported in the same way
- `::before`, `::after` — not supported

## Theme System (marble + Catppuccin)

This codebase uses **marble's runtime Theme service** — no SCSS compilation.
CSS is built as strings in `theme.ts`:

```typescript
import { Theme } from "marble/service/Theme"

// GTK4 named colors (used with @ prefix in CSS)
const dark = `
  @define-color accent_bg_color #89b4fa;
  @define-color accent_fg_color #1e1e2e;
  @define-color view_bg_color #1e1e2e;
`

// marble CSS variables (used with var() in CSS)
const marbleVars = `
  * {
    --marble-bg: #1e1e2e;
    --marble-primary: #89b4fa;
    --marble-roundness: 12px;
  }
`

Theme.Stylesheet({ dark: dark + marbleVars, light: lightVersion })
```

## GTK-Specific Color Functions

```css
/* Named color reference (defined via @define-color) */
background: @accent_bg_color;
color: @view_fg_color;

/* Color functions */
background: alpha(@view_bg_color, 0.85);   /* Set alpha */
background: lighter(@view_bg_color);        /* Lighten */
background: darker(@view_bg_color);         /* Darken */
background: shade(@view_bg_color, 1.2);     /* Scale by factor */
background: mix(@accent_bg_color, @view_bg_color, 0.5); /* Blend */
```

## Inline CSS on Widgets

The `css` property applies styles directly. Does NOT cascade to children:

```tsx
<box css="background: alpha(@view_bg_color, 0.85); border-radius: 12px; padding: 8px;" />
<label css="color: #cba6f7; font-size: 14pt; font-weight: bold;" label="Title" />
```

## CSS Classes and Names

```tsx
// cssClasses → CSS class selectors
<box cssClasses={["panel", "active"]} />
// Matches: .panel { ... }  .panel.active { ... }

// cssName → CSS name selector (like element ID)
<box cssName="my-widget" />
// Matches: box#my-widget { ... }
```

## Animations

```css
@keyframes slide-in {
  from { margin-left: -100px; opacity: 0; }
  to { margin-left: 0; opacity: 1; }
}

.notification {
  animation: slide-in 300ms ease-out;
}

button {
  transition: background-color 200ms ease-in-out;
}
```

## Catppuccin Mocha Palette (used in theme.ts)

| Role | Color | Hex |
|------|-------|-----|
| Base (bg) | base | `#1e1e2e` |
| Surface | surface0 | `#313244` |
| Text | text | `#cdd6f4` |
| Subtext | subtext0 | `#a6adc8` |
| Blue (accent) | blue | `#89b4fa` |
| Mauve | mauve | `#cba6f7` |
| Green | green | `#a6e3a1` |
| Red | red | `#f38ba8` |
| Peach | peach | `#fab387` |
| Yellow | yellow | `#f9e2af` |

## Debugging

```bash
ags inspect     # Opens GTK Inspector
```

In the Inspector:
- Browse the widget tree and see applied CSS
- Edit CSS live in the CSS tab
- Check which selectors match each widget
- Verify computed property values
