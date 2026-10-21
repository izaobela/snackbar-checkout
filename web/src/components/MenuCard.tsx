import { Icon } from './Icon'
import styles from './MenuCard.module.css'
import { ProductImage } from './ProductImage'
import type { Item } from '../api/types'
import { formatMoney } from '../lib/money'

type Props = { item: Item; quantity: number; currency: string; onAdd: (itemId: string) => void }

const TAG_LABEL: Record<string, string> = { vegetarian: 'V', vegan: 'VG', 'gluten-free': 'GF' }

// Worth saying out loud only when it is about to run out.
const fewLeft = (item: Item) => item.available && item.stock != null && item.stock <= 3

export function MenuCard({ item, quantity, currency, onAdd }: Props) {
  const soldOut = !item.available
  const price = formatMoney(item.price_cents, currency)
  const allergens = item.allergens.join(', ')
  const label = [
    soldOut ? `${item.name}, Sold out` : `Add one ${item.name}, ${price}`,
    item.tags.join(', '),
    allergens && `Contains ${allergens}`,
    fewLeft(item) && `${item.stock} left`,
    quantity > 0 && `${quantity} in your order`,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <button
      type="button"
      className={`${styles.card} ${soldOut ? styles.soldOut : ''} ${quantity > 0 ? styles.inOrder : ''}`}
      disabled={soldOut}
      onClick={() => onAdd(item.id)}
      aria-label={label}
      data-item={item.id}
    >
      <span className={styles.photo} aria-hidden="true">
        <ProductImage item={item} className={styles.image} />
        <span className={styles.plus}>{quantity > 0 ? <span className={styles.count}>{quantity}</span> : <Icon name="plus" size={22} />}</span>
      </span>
      <span className={styles.name}>{item.name}</span>
      <span className={styles.description}>{item.description}</span>
      {allergens && <span className={styles.allergens}>Contains {allergens}</span>}
      <span className={styles.foot}>
        <span className={`${styles.price} money`}>{price}</span>
        {soldOut ? (
          <span className={styles.soldOutLabel}>Sold out</span>
        ) : fewLeft(item) ? (
          <span className={styles.left}>{item.stock} left</span>
        ) : (
          <span className={styles.tags}>
            {item.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {TAG_LABEL[tag] ?? tag}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  )
}
