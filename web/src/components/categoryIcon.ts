import type { IconName } from './Icon'

export const CATEGORY_ICON: Record<string, IconName> = {
  drinks: 'cup',
  bakery: 'bread',
  snacks: 'bag',
  sweets: 'cookie',
  fresh: 'leaf',
}

export function categoryIcon(categoryId: string): IconName {
  return CATEGORY_ICON[categoryId] ?? 'cup'
}
