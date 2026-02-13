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

type NotificationCardProps = {
  popup?: boolean
}

export function NotificationCard({ popup = false }: NotificationCardProps) {
  const cardCss = popup
    ? "background: alpha(@view_bg_color, 0.9); border-radius: 14px; border: 1px solid alpha(@view_fg_color, 0.08); box-shadow: 0 10px 24px alpha(@view_bg_color, 0.75); min-width: 420px;"
    : "background: alpha(@view_bg_color, 0.6); border-radius: 8px;"

  const headerCss = popup ? "padding: 10px 14px;" : "padding: 8px 12px;"
  const bodyCss = popup ? "padding: 12px 14px 14px;" : "padding: 10px 12px;"
  const imageSize = popup ? 72 : 86

  return (
    <NotificationRoot>
      <Box hexpand vertical css={cardCss}>
        <Box gap={8} css={headerCss}>
          <NotificationAppIcon css="min-width: 16px; min-height: 16px;" />
          <NotificationAppName size={0.8} opacity={0.8} />
          <Box hexpand />
          <NotificationTimestamp size={0.75} opacity={0.7} format="%I:%M %p" />
          <NotificationDismissButton flat css="min-width: 20px; min-height: 20px; padding: 2px;">
            <Icon icon="window-close" />
          </NotificationDismissButton>
        </Box>
        {popup ? (
          <NotificationTimeoutBar
            length={420}
            width={2}
            r={2}
            p={0}
            css="min-height: 2px; background: alpha(@view_fg_color, 0.18);"
          />
        ) : null}
        <Box gap={12} css={bodyCss}>
          <NotificationImage
            size={imageSize}
            css="border-radius: 10px; background: alpha(@view_fg_color, 0.08);"
          />
          <Box vertical gap={4}>
            <NotificationSummary bold />
            <NotificationBody size={0.9} opacity={0.8} />
          </Box>
        </Box>
      </Box>
    </NotificationRoot>
  )
}
