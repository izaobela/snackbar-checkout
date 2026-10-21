import type { ReactNode } from 'react'

import { Icon } from './Icon'
import styles from './CardFields.module.css'
import { type CardDraft, type CardErrors, type CardField, brandName, detectBrand, formatExpiry, groupNumber } from '../lib/card'

type Props = {
  draft: CardDraft
  errors: CardErrors
  active: CardField
  onFocusField: (field: CardField) => void
  onChangeField: (field: CardField, value: string) => void
}

// Real inputs with inputMode="none": the keypad fills them on the tablet, a keyboard or a paste on a laptop.
export function CardFields({ draft, errors, active, onFocusField, onChangeField }: Props) {
  const brand = detectBrand(draft.number)
  return (
    <div className={styles.fields}>
      <Field id="card-number" label="Card number" error={errors.number} active={active === 'number'}>
        <div className={styles.inline}>
          <Icon name="card" size={22} />
          <input
            id="card-number"
            className={styles.input}
            value={groupNumber(draft.number, brand)}
            inputMode="none"
            autoComplete="off"
            aria-invalid={errors.number ? true : undefined}
            aria-describedby={errors.number ? 'card-number-error' : undefined}
            onFocus={() => onFocusField('number')}
            onChange={(event) => onChangeField('number', event.target.value)}
          />
          {brand !== 'unknown' && <span className={styles.brand}>{brandName(brand)}</span>}
        </div>
      </Field>
      <div className={styles.row}>
        <Field id="card-expiry" label="Expiry" hint="MM/YY" error={errors.expiry} active={active === 'expiry'}>
          <input
            id="card-expiry"
            className={styles.input}
            value={formatExpiry(draft.expiry)}
            inputMode="none"
            autoComplete="off"
            aria-invalid={errors.expiry ? true : undefined}
            aria-describedby={errors.expiry ? 'card-expiry-error' : undefined}
            onFocus={() => onFocusField('expiry')}
            onChange={(event) => onChangeField('expiry', event.target.value)}
          />
        </Field>
        <Field id="card-cvc" label="Security code" hint="On the back of the card" error={errors.cvc} active={active === 'cvc'}>
          <input
            id="card-cvc"
            className={styles.input}
            value={'•'.repeat(draft.cvc.length)}
            inputMode="none"
            autoComplete="off"
            aria-invalid={errors.cvc ? true : undefined}
            aria-describedby={errors.cvc ? 'card-cvc-error' : undefined}
            onFocus={() => onFocusField('cvc')}
            onChange={(event) => onChangeField('cvc', event.target.value)}
          />
        </Field>
      </div>
    </div>
  )
}

type FieldProps = { id: string; label: string; hint?: string; error?: string; active: boolean; children: ReactNode }

function Field({ id, label, hint, error, active, children }: FieldProps) {
  return (
    <div className={`${styles.field} ${active ? styles.active : ''} ${error ? styles.hasError : ''}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {hint && <span className={styles.hint}> {hint}</span>}
      </label>
      {children}
      {error && (
        <span id={`${id}-error`} className={styles.error} role="alert">
          <Icon name="alert" size={18} />
          {error}
        </span>
      )}
    </div>
  )
}
