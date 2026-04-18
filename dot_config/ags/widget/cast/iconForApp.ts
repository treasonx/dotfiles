import Gtk from "gi://Gtk?version=4.0"
import Gdk from "gi://Gdk?version=4.0"

const FALLBACK = "application-x-executable"

let cachedTheme: Gtk.IconTheme | null = null
function iconTheme(): Gtk.IconTheme | null {
  if (cachedTheme) return cachedTheme
  const display = Gdk.Display.get_default()
  if (!display) return null
  cachedTheme = Gtk.IconTheme.get_for_display(display)
  return cachedTheme
}

/**
 * Resolve a niri Window.app_id to an icon name suitable for marble's <Icon>.
 * Returns the app_id verbatim when GTK's icon theme has it, otherwise a
 * generic application icon — never the empty string, since downstream
 * <Icon> consumers don't gracefully degrade on null/empty.
 *
 * Caveat: app_id may be lowercased / Reverse-DNS / arbitrary depending on
 * the toolkit (Electron, WINE, GTK, Qt all differ). When the theme misses,
 * we don't try fancy heuristics — fallback icon is fine for v1.
 */
export function iconForAppId(appId: string | null | undefined): string {
  if (!appId) return FALLBACK
  const theme = iconTheme()
  if (!theme) return FALLBACK
  return theme.has_icon(appId) ? appId : FALLBACK
}
