/**
 * A Customer's type on the detail page (customers.md): its icon, then its name, with no label.
 * It replaces the old VIP line. Nothing shows while Customer types is off, or when the Customer
 * has no type; the icon is decorative because the name sits right beside it.
 */

import { useCustomerTypes } from '../../api/customerTypes'
import { useIsVipCustomers } from '../../api/pricingSettings'
import { glyphOf } from '../../customerTypes/icons'

export default function CustomerTypeLine({ typeId }: { typeId: number | null }) {
  const enabled = useIsVipCustomers()
  const types = useCustomerTypes().data
  const type = enabled && typeId !== null ? types?.find((item) => item.id === typeId) : undefined
  if (type === undefined) return null
  return (
    <div className="campo">
      <span>
        <span aria-hidden="true">{glyphOf(type.icon)}</span> {type.name}
      </span>
    </div>
  )
}
