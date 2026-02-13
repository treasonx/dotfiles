import Gio from "gi://Gio"
import { Gtk } from "ags/gtk4"
import { Box, Text, Button, Icon, Picture } from "marble/components"

const PREVIEW_SIZE = 48

export type SidebarItemAction = {
  label: string
  onClick: () => void
}

export type SidebarItemProps = {
  imagePath?: string | null
  icon: string
  title: string
  subtitle: string
  actions: SidebarItemAction[]
}

export function SidebarItem({ imagePath, icon, title, subtitle, actions }: SidebarItemProps) {
  return (
    <Box
      gap={8}
      heightRequest={60}
      css="padding: 6px 8px; border-radius: 8px; background: alpha(@view_fg_color, 0.04);"
    >
      <Gtk.Frame
        widthRequest={PREVIEW_SIZE}
        heightRequest={PREVIEW_SIZE}
        hexpand={false}
        vexpand={false}
        halign={Gtk.Align.START}
        valign={Gtk.Align.CENTER}
        overflow={Gtk.Overflow.HIDDEN}
        css={`border-radius: 8px; background: alpha(@view_fg_color, 0.08); border: none; padding: 0; min-width: ${PREVIEW_SIZE}px; min-height: ${PREVIEW_SIZE}px;`}
      >
        {imagePath ? (
          <Picture
            file={Gio.File.new_for_path(imagePath)}
            maxWidth={PREVIEW_SIZE}
            maxHeight={PREVIEW_SIZE}
            contain
          />
        ) : (
          <Box valign="center" halign="center" hexpand vexpand>
            <Icon icon={icon} />
          </Box>
        )}
      </Gtk.Frame>
      <Box vertical hexpand valign="center" css="min-width: 0;">
        <Text size={0.9} truncate>{title}</Text>
        <Text size={0.75} opacity={0.5} truncate>{subtitle}</Text>
      </Box>
      <Box gap={4}>
        {actions.map((action) => (
          <Button flat color="fg" onPrimaryClick={action.onClick} px={6} py={2}>
            <Text size={0.8}>{action.label}</Text>
          </Button>
        ))}
      </Box>
    </Box>
  )
}
