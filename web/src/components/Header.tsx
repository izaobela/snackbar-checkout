import { Icon, type IconName } from './Icon'
import styles from './Header.module.css'

const STEPS = ['Order', 'Pay', 'Pick up']

type Props = {
  step: 0 | 1 | 2
  action?: { label: string; icon: IconName; onClick: () => void }
  onStartOver: () => void
  showStartOver: boolean
}

export function Header({ step, action, onStartOver, showStartOver }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <Icon name="cup" size={22} />
        </span>
        <span className={styles.name}>Iza &amp; Bela</span>
        <span className={styles.tagline}>Snack bar</span>
      </div>
      <ol className={styles.steps} aria-label="Progress">
        {STEPS.map((label, index) => {
          const state = index < step ? 'done' : index === step ? 'current' : 'todo'
          return (
            <li key={label} className={`${styles.step} ${styles[state] ?? ''}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className={styles.stepNumber} aria-hidden="true">
                {state === 'done' ? <Icon name="check" size={16} /> : index + 1}
              </span>
              <span>{label}</span>
            </li>
          )
        })}
      </ol>
      <div className={styles.actions}>
        {action && (
          <button type="button" className={styles.action} onClick={action.onClick}>
            <Icon name={action.icon} size={20} />
            <span>{action.label}</span>
          </button>
        )}
        {showStartOver && (
          <button type="button" className={styles.action} onClick={onStartOver}>
            <Icon name="undo" size={20} />
            <span>Start over</span>
          </button>
        )}
      </div>
    </header>
  )
}
