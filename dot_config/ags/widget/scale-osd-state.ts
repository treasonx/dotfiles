import { createState } from "gnim"

const [scaleValue, setScaleValue] = createState(1.0)
const [scaleVisible, setScaleVisible] = createState(false)

export { scaleValue, scaleVisible }

const HIDE_MS = 1400
let hideTimer: ReturnType<typeof setTimeout> | null = null

export function showScaleOsd(value: number) {
  setScaleValue(value)
  setScaleVisible(true)
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    setScaleVisible(false)
    hideTimer = null
  }, HIDE_MS)
}
