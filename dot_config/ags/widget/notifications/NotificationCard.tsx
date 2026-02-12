import {
  NotificationRoot,
  NotificationAppIcon,
  NotificationAppName,
  NotificationTimestamp,
  NotificationSummary,
  NotificationBody,
  NotificationActions,
  NotificationDismissButton,
  NotificationImage,
  NotificationTimeoutBar,
} from "marble/components"
import { Box, Icon } from "marble/components"
import Hyprland from "gi://AstalHyprland"
import { SIDEBAR_WIDTH_FRACTION } from "../sidebar-state"

export function NotificationCard() {
  const hypr = Hyprland.get_default()
  const monitorWidth = hypr.get_focused_monitor().get_width()
  const width = Math.round(monitorWidth * SIDEBAR_WIDTH_FRACTION)

  return (
    <NotificationRoot>
      <Box
        hexpand
        vertical
        css={`min-width: ${width}px; background: alpha(@view_bg_color, 0.6); border-radius: 8px; overflow: hidden;`}
      >
        <Box gap={8} css="padding: 8px 12px;">
          <NotificationAppIcon css="min-width: 16px; min-height: 16px;" />
          <NotificationAppName size={0.8} opacity={0.8} />
          <Box hexpand />
          <NotificationTimestamp size={0.75} opacity={0.7} format="%I:%M %p" />
          <NotificationDismissButton flat css="min-width: 20px; min-height: 20px; padding: 2px;">
            <Icon icon="window-close" />
          </NotificationDismissButton>
        </Box>
        <Box gap={12} css="padding: 10px 12px;">
          <NotificationImage size={86} />
          <Box vertical gap={4}>
            <NotificationSummary bold />
            <NotificationBody size={0.9} opacity={0.8} />
          </Box>
        </Box>
      </Box>
    </NotificationRoot>
  )
}
