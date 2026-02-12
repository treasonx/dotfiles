import Theme from "marble/service/Theme"

// Catppuccin Mocha — the signature dark variant
const mocha = {
  rosewater: "#f5e0dc",
  flamingo: "#f2cdcd",
  pink: "#f5c2e7",
  mauve: "#cba6f7",
  red: "#f38ba8",
  maroon: "#eba0ac",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  teal: "#94e2d5",
  sky: "#89dceb",
  sapphire: "#74c7ec",
  blue: "#89b4fa",
  lavender: "#b4befe",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay2: "#9399b2",
  overlay1: "#7f849c",
  overlay0: "#6c7086",
  surface2: "#585b70",
  surface1: "#45475a",
  surface0: "#313244",
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
}

// Catppuccin Latte — the light variant
const latte = {
  rosewater: "#dc8a78",
  flamingo: "#dd7878",
  pink: "#ea76cb",
  mauve: "#8839ef",
  red: "#d20f39",
  maroon: "#e64553",
  peach: "#fe640b",
  yellow: "#df8e1d",
  green: "#40a02b",
  teal: "#179299",
  sky: "#04a5e5",
  sapphire: "#209fb5",
  blue: "#1e66f5",
  lavender: "#7287fd",
  text: "#4c4f69",
  subtext1: "#5c5f77",
  subtext0: "#6c6f85",
  overlay2: "#7c7f93",
  overlay1: "#8c8fa1",
  overlay0: "#9ca0b0",
  surface2: "#acb0be",
  surface1: "#bcc0cc",
  surface0: "#ccd0da",
  base: "#eff1f5",
  mantle: "#e6e9ef",
  crust: "#dce0e8",
}

// Build a CSS string that sets both marble variables (--marble-*)
// and GTK4 Adwaita named colors (@define-color). Using the string
// format means marble's Theme service swaps the entire CSS provider
// when switching dark ↔ light, so both sets of overrides stay in sync.
function buildCSS(p: typeof mocha) {
  return `
    /* GTK4 named color overrides — picked up by @view_bg_color etc. in inline CSS */
    @define-color view_bg_color ${p.base};
    @define-color view_fg_color ${p.text};
    @define-color window_bg_color ${p.mantle};
    @define-color window_fg_color ${p.text};
    @define-color headerbar_bg_color ${p.mantle};
    @define-color headerbar_fg_color ${p.text};
    @define-color card_bg_color ${p.surface0};
    @define-color card_fg_color ${p.text};
    @define-color popover_bg_color ${p.surface0};
    @define-color popover_fg_color ${p.text};
    @define-color dialog_bg_color ${p.surface0};
    @define-color dialog_fg_color ${p.text};

    @define-color accent_bg_color ${p.mauve};
    @define-color accent_fg_color ${p.crust};
    @define-color accent_color ${p.mauve};

    @define-color success_color ${p.green};
    @define-color success_bg_color ${p.green};
    @define-color warning_color ${p.peach};
    @define-color warning_bg_color ${p.peach};
    @define-color error_color ${p.red};
    @define-color error_bg_color ${p.red};
    @define-color destructive_color ${p.red};
    @define-color destructive_bg_color ${p.red};

    /* Global font — JetBrainsMono Nerd Font for icon glyph support */
    * {
      font-family: "JetBrainsMono Nerd Font";
      font-weight: bold;
    }

    /* Marble CSS variables — used by marble/components */
    :root {
      --marble-bg: ${p.base};
      --marble-fg: ${p.text};
      --marble-primary: ${p.mauve};
      --marble-success: ${p.green};
      --marble-error: ${p.red};
      --marble-widget-bg: ${p.text};
      --marble-widget-opacity: 0.08;
      --marble-widget-hover-opacity: 0.12;
      --marble-border-color: ${p.surface1};
      --marble-border-opacity: 0.5;
      --marble-shadow-color: rgba(0, 0, 0, 0.6);
    }
  `
}

const theme = Theme.get_default()

export const catppuccin = new Theme.Stylesheet("Catppuccin", {
  stylesheet: {
    dark: buildCSS(mocha),
    light: buildCSS(latte),
  },
})

theme.addTheme(catppuccin)
catppuccin.activate()
