type OrderAddress = {
  addr?: string | null
  street?: string | null
  home?: string | number | null
}

export function getOrderAddress(order: OrderAddress): string {
  const address = order.addr?.trim()
  if (address) return address

  return [order.street, order.home]
    .map(part => String(part ?? '').trim())
    .filter(part => part.length > 0)
    .join(', ')
}
