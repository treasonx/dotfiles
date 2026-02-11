---
name: gtk4-css-theming
description: >
  Use when styling widgets, writing CSS/SCSS, changing colors, modifying theme,
  or debugging visual issues. GTK4 CSS differs significantly from web CSS — many
  common web properties do NOT exist. Triggers on "style widget", "change colors",
  "update CSS/SCSS", "theme AGS", "fix styling", or any work on .scss/.css files.
---

# GTK4 CSS Theming

GTK4 CSS is a subset of web CSS with GTK-specific extensions. LLMs frequently
hallucinate web CSS properties that do not work in GTK4.

## Supported Properties

These properties work in GTK4 CSS:

**Layout:** `margin`, `padding`, `min-width`, `min-height`
**Colors:** `background`, `background-color`, `color`, `opacity`
**Borders:** `border`, `border-color`, `border-width`, `border-style`, `border-radius`
**Typography:** `font-family`, `font-size`, `font-weight`, `font-style`
**Effects:** `transition` (property, duration, timing-function), `animation`, `@keyframes`
**Icons:** `-gtk-icon-size`, `-gtk-icon-style`

## NOT Supported (Do NOT Use)

These common web CSS properties **do not exist** in GTK4:

- `display` (flex, grid, block, none) — layout is controlled by widget type (Box, CenterBox, etc.)
- `position` (absolute, relative, fixed) — use layer shell anchoring instead
- `flex`, `flex-direction`, `flex-grow` — use `hexpand`/`vexpand` widget properties
- `grid`, `grid-template-*` — use Grid widget
- `z-index` — layer stacking is controlled by layer shell
- `box-shadow` — not supported (use border tricks or image assets)
- `text-align` — use `halign` widget property
- `overflow` — not supported
- `transform` — not supported (except in `@keyframes`)
- `width`, `height` — use `min-width`, `min-height` instead
- `cursor` — not supported in the same way
- `::before`, `::after` — not supported

## GTK-Specific Features

```scss
// Color definitions (GTK syntax, NOT CSS variables)
@define-color accent_color #89b4fa;

// Color functions
background: lighter($ctp-base);        // Lighten
background: darker($ctp-surface0);     // Darken
background: shade($ctp-base, 1.2);     // Scale by factor
background: alpha($ctp-text, 0.8);     // Set alpha
background: mix($ctp-blue, $ctp-red, 0.5);  // Blend colors
```

## SCSS in AGS

AGS bundles SCSS automatically — import `.scss` files and they're inlined as strings:

```typescript
import style from "./style.scss"    // Resolved at bundle time
app.start({ css: style })           // Applied as global stylesheet
```

The `cssClasses` prop on widgets maps to CSS class selectors:
```tsx
<box cssClasses={["panel", "active"]} />
```
```scss
.panel { background: $ctp-base; }
.panel.active { border-color: $ctp-blue; }
```

The `cssName` prop maps to the widget's CSS name (like element selector):
```tsx
<box cssName="my-widget" />
```
```scss
box#my-widget { padding: 8px; }  // By name
```

## Inline Styles

The `css` property on widgets does NOT cascade to children:
```tsx
<label css="color: red; font-size: 14pt;" label="Warning" />
```

## Animations

```scss
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

## Debugging

```bash
ags inspect     # Opens GTK Inspector
```

In the Inspector:
- Browse the widget tree and see applied CSS
- Edit CSS live in the CSS tab
- Check which selectors match each widget
- Verify computed property values

## Project Tokens

All colors are defined in `scss/_catppuccin.scss` as SCSS variables:
- Backgrounds: `$ctp-base`, `$ctp-mantle`, `$ctp-crust`
- Text: `$ctp-text`, `$ctp-subtext0`, `$ctp-subtext1`
- Borders/surfaces: `$ctp-surface0`, `$ctp-surface1`, `$ctp-surface2`
- Accents: `$ctp-blue`, `$ctp-mauve`, `$ctp-green`, `$ctp-red`, `$ctp-peach`, `$ctp-yellow`

Standard styling patterns:
```scss
@use '../scss/catppuccin' as *;
@use '../scss/mixins' as *;

.my-panel {
  @include panel-section;    // base bg, surface0 border, 10px radius
}

.my-button {
  @include hover-effect;     // 200ms transition, surface0 hover bg
}
```
