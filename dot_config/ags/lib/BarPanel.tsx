import { Astal, Gtk, Gdk } from "ags/gtk4"
import app from "ags/gtk4/app"
import { Box } from "marble/components"
import type { Binding } from "gnim"

type MaybeBinding<T> = T | Binding<T>

export function BarPanel({
  name,
  visible,
  gdkmonitor,
  anchor = Astal.WindowAnchor.BOTTOM,
  layer = Astal.Layer.OVERLAY,
  onEscape,
  padding = "12px",
  gap = 16,
  defaultWidth,
  defaultHeight,
  marginLeft,
  heightRequest,
  widthRequest,
  children,
}: {
  name: string
  visible: MaybeBinding<boolean>
  gdkmonitor: Gdk.Monitor
  anchor?: number
  layer?: Astal.Layer
  onEscape: () => void
  padding?: string
  gap?: number
  defaultWidth?: MaybeBinding<number>
  defaultHeight?: MaybeBinding<number>
  marginLeft?: MaybeBinding<number>
  heightRequest?: MaybeBinding<number>
  widthRequest?: MaybeBinding<number>
  children?: JSX.Element | JSX.Element[]
}) {
  function handleKey(
    _controller: Gtk.EventControllerKey,
    keyval: number,
  ): boolean {
    if (keyval === Gdk.KEY_Escape) {
      onEscape()
      return true
    }
    return false
  }

  // Build optional window props
  const windowExtras: Record<string, unknown> = {}
  if (defaultWidth !== undefined) windowExtras.defaultWidth = defaultWidth
  if (defaultHeight !== undefined) windowExtras.defaultHeight = defaultHeight
  if (marginLeft !== undefined) windowExtras.marginLeft = marginLeft

  // Build optional revealer props
  const revealerExtras: Record<string, unknown> = {}
  if (heightRequest !== undefined) revealerExtras.heightRequest = heightRequest

  // Build optional box props
  const boxExtras: Record<string, unknown> = {}
  if (widthRequest !== undefined) boxExtras.widthRequest = widthRequest

  return (
    <window
      name={name}
      visible={visible}
      gdkmonitor={gdkmonitor}
      anchor={anchor}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={layer}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
      {...windowExtras}
    >
      <Gtk.EventControllerKey onKeyPressed={handleKey} />
      <Gtk.Revealer
        revealChild={visible}
        transitionType={Gtk.RevealerTransitionType.SLIDE_UP}
        transitionDuration={150}
        {...revealerExtras}
      >
        <Box
          vertical
          vexpand
          gap={gap}
          css={`background: alpha(@view_bg_color, 0.92); border-radius: 12px 12px 0 0; padding: ${padding};`}
          {...boxExtras}
        >
          {children}
        </Box>
      </Gtk.Revealer>
    </window>
  )
}
