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
import { Box } from "marble/components"

export function NotificationCard() {
  return (
    <NotificationRoot>
      <Box
        vertical
        gap={8}
        css="padding: 12px; background: alpha(@view_bg_color, 0.6); border-radius: 8px;"
      >
        <Box gap={8}>
          <NotificationAppIcon css="min-width: 16px; min-height: 16px;" />
          <NotificationAppName size={0.8} opacity={0.6} />
          <Box hexpand />
          <NotificationTimestamp size={0.75} opacity={0.4} format="%I:%M %p" />
          <NotificationDismissButton
            css="min-width: 20px; min-height: 20px; padding: 2px;"
          />
        </Box>
        <NotificationSummary bold />
        <NotificationBody size={0.9} opacity={0.8} />
        <NotificationImage size={64} />
        <NotificationActions css="margin-top: 4px;" />
        <NotificationTimeoutBar />
      </Box>
    </NotificationRoot>
  )
}
