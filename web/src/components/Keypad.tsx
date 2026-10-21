import { Icon } from './Icon'
import styles from './Keypad.module.css'

type Props = { onDigit: (digit: string) => void; onDelete: () => void; onNext: () => void; disabled?: boolean }

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function Keypad({ onDigit, onDelete, onNext, disabled }: Props) {
  return (
    <fieldset className={styles.keypad}>
      <legend className="visually-hidden">Keypad</legend>
      {DIGITS.map((digit) => (
        <button key={digit} type="button" className={styles.key} onClick={() => onDigit(digit)} disabled={disabled}>
          {digit}
        </button>
      ))}
      <button type="button" className={`${styles.key} ${styles.soft}`} onClick={onDelete} disabled={disabled} aria-label="Delete">
        <Icon name="delete" size={26} />
      </button>
      <button type="button" className={styles.key} onClick={() => onDigit('0')} disabled={disabled}>
        0
      </button>
      <button type="button" className={`${styles.key} ${styles.soft}`} onClick={onNext} disabled={disabled}>
        Next
        <Icon name="arrowRight" size={20} />
      </button>
    </fieldset>
  )
}
