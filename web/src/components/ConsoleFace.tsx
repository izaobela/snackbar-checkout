import styles from './ConsoleFace.module.css'

export type Mood = 'idle' | 'thinking' | 'happy' | 'sad'

type Props = { mood: Mood; className?: string }

type Block = [x: number, y: number, w?: number, h?: number]

const EYES: Record<Mood, Block[]> = {
  idle: [
    [4, 4, 3, 3],
    [17, 4, 3, 3],
  ],
  thinking: [
    [6, 4, 3, 3],
    [19, 4, 3, 3],
  ],
  happy: [
    [4, 5, 3, 1],
    [17, 5, 3, 1],
  ],
  sad: [
    [4, 5, 3, 2],
    [17, 5, 3, 2],
  ],
}

const SMILE: Block[] = [[7, 10], [8, 11], [9, 12], [10, 12], [11, 12], [12, 12], [13, 12], [14, 12], [15, 11], [16, 10]]

const MOUTH: Record<Mood, Block[]> = {
  idle: SMILE,
  thinking: [[9, 11], [10, 11], [11, 11], [12, 11], [13, 11], [14, 11]],
  happy: [...SMILE, [9, 13], [10, 13], [11, 13], [12, 13], [13, 13], [14, 13]],
  sad: [[7, 12], [8, 11], [9, 10], [10, 10], [11, 10], [12, 10], [13, 10], [14, 10], [15, 11], [16, 12]],
}

/** The scanner's face: a few pixels on a 24 by 16 grid, drawn crisp. */
export function ConsoleFace({ mood, className = '' }: Props) {
  return (
    <svg viewBox="0 0 24 16" className={`${styles.face} ${className}`} shapeRendering="crispEdges" aria-hidden="true">
      {EYES[mood].map(([x, y, w = 1, h = 1]) => (
        <rect key={`e${x}-${y}`} className={mood === 'idle' ? styles.eye : undefined} x={x} y={y} width={w} height={h} />
      ))}
      {MOUTH[mood].map(([x, y, w = 1, h = 1]) => (
        <rect key={`m${x}-${y}`} x={x} y={y} width={w} height={h} />
      ))}
    </svg>
  )
}
