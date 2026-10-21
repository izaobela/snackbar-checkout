import { ConsoleFace } from '../components/ConsoleFace'
import { Icon } from '../components/Icon'
import styles from './StartScreen.module.css'

type Props = { onScan: () => void; onBrowse: () => void }

export function StartScreen({ onScan, onBrowse }: Props) {
  return (
    <section className={styles.start} aria-labelledby="start-title">
      <p className={styles.kicker}>Welcome to Iza &amp; Bela Snack Bar</p>
      <h1 id="start-title" className={styles.title}>
        How would you like to order?
      </h1>
      <div className={styles.choices}>
        <button type="button" className={styles.choice} onClick={onScan} data-testid="start-scan">
          <span className={`${styles.choiceIcon} ${styles.screen}`}>
            <ConsoleFace mood="idle" className={styles.face} />
          </span>
          <span className={styles.choiceTitle}>Scan your products</span>
          <span className={styles.choiceBody}>Place each item in front of the scanner and it goes straight into your order.</span>
        </button>
        <button type="button" className={styles.choice} onClick={onBrowse} data-testid="start-browse">
          <span className={styles.choiceIcon}>
            <Icon name="list" size={40} />
          </span>
          <span className={styles.choiceTitle}>Browse the menu</span>
          <span className={styles.choiceBody}>See everything we have today and tap what you want.</span>
        </button>
      </div>
    </section>
  )
}
