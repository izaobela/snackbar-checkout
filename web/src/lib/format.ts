export const itemCount = (n: number) => (n === 1 ? '1 item' : `${n} items`)

/** The order id as a receipt prints it: the first eight characters, no hyphens, upper case. */
export const orderCode = (id: string) => id.replace(/-/g, '').slice(0, 8).toUpperCase()

const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
