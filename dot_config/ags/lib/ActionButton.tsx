import { Box, Text, Button } from "marble/components"

type ActionButtonSize = "small" | "medium" | "large"

type ActionButtonProps = {
  label: string
  icon?: string
  size?: ActionButtonSize
  color?: "primary" | "fg"
  onPrimaryClick: () => void
  css?: string | ReturnType<any>
  halign?: any
  [key: string]: any
}

const sizeConfig: Record<ActionButtonSize, { text: number; icon: number; px: number; py: number; gap: number; r: number }> = {
  small:  { text: 0.85, icon: 0.95, px: 8,  py: 3, gap: 5, r: 8  },
  medium: { text: 1.0,  icon: 1.1,  px: 12, py: 6, gap: 6, r: 10 },
  large:  { text: 1.2,  icon: 1.3,  px: 16, py: 8, gap: 8, r: 12 },
}

export function ActionButton({
  label,
  icon,
  size = "medium",
  color = "primary",
  onPrimaryClick,
  css,
  ...rest
}: ActionButtonProps) {
  const cfg = sizeConfig[size]

  return (
    <Button
      color={color}
      r={cfg.r}
      py={cfg.py}
      px={cfg.px}
      onPrimaryClick={onPrimaryClick}
      css={css}
      {...rest}
    >
      <Box gap={cfg.gap} halign="center">
        {icon && <Text size={cfg.icon}>{icon}</Text>}
        <Text size={cfg.text} weight="bold">{label}</Text>
      </Box>
    </Button>
  )
}
