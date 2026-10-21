import type { SVGProps } from 'react'

export type IconName =
  | 'plus'
  | 'minus'
  | 'trash'
  | 'arrowLeft'
  | 'arrowRight'
  | 'check'
  | 'help'
  | 'clock'
  | 'alert'
  | 'card'
  | 'reader'
  | 'undo'
  | 'close'
  | 'delete'
  | 'cup'
  | 'bread'
  | 'bag'
  | 'cookie'
  | 'leaf'
  | 'knobs'
  | 'scan'
  | 'camera'
  | 'list'

const PATHS: Record<IconName, string> = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 13l4 4L19 7',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4M12 17h.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  alert: 'M12 3l10 18H2L12 3zM12 10v4M12 17.5h.01',
  card: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM3 10h18M7 15h4',
  reader: 'M8 12a4 4 0 0 1 4-4M5 12a7 7 0 0 1 7-7M2 12a10 10 0 0 1 10-10M12 12h.01',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  close: 'M6 6l12 12M18 6L6 18',
  delete: 'M20 6H9l-6 6 6 6h11a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1zM12 9l6 6M18 9l-6 6',
  cup: 'M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8zM16 9h2a2 2 0 0 1 0 4h-2M4 21h14',
  bread: 'M4 11a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8H4v-8zM9 7V5M13 7V5',
  bag: 'M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2',
  cookie: 'M12 21a9 9 0 1 1 8.5-12A4 4 0 0 1 16 13a4 4 0 0 1 0-8 9 9 0 0 1-4 16zM9 10h.01M8 15h.01M13 16h.01',
  leaf: 'M5 19C5 10 10 5 19 5c0 9-5 14-14 14zM5 19l7-7',
  knobs: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16',
  camera: 'M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  list: 'M4 7h16M4 12h16M4 17h16',
}

type Props = SVGProps<SVGSVGElement> & { name: IconName; size?: number; label?: string }

export function Icon({ name, size = 24, label, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
