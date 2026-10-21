import styles from './Barcode.module.css'
import { code39 } from '../lib/barcode'

type Props = { value: string; label: string }

/** A Code 39 barcode as one SVG, the bars merged into as few rectangles as possible. */
export function Barcode({ value, label }: Props) {
  const modules = code39(value)
  const bars: { x: number; width: number }[] = []
  modules.forEach((ink, x) => {
    if (!ink) return
    const last = bars[bars.length - 1]
    if (last && last.x + last.width === x) last.width += 1
    else bars.push({ x, width: 1 })
  })
  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the inline SVG is the image
    <svg className={styles.barcode} viewBox={`0 0 ${modules.length} 40`} preserveAspectRatio="none" role="img" aria-label={label} shapeRendering="crispEdges">
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.width} height={40} />
      ))}
    </svg>
  )
}
