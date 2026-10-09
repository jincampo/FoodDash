import { useCallback } from 'react'
import { useCart, useStoreDispatch } from './store'
import type { Order } from './store'
import { useUI } from './ui'

/** Which screen the reorder started from, for `reorder_completed`. */
type ReorderSource = 'track_order' | 'order_history'

/**
 * Refills the cart from a past order and opens the drawer so the next step is
 * obvious. Shared by the tracking screen and order history.
 */
export function useReorder(): (order: Order, source: ReorderSource) => void {
  const dispatch = useStoreDispatch()
  const cart = useCart()
  const { openCart, notify } = useUI()

  return useCallback(
    (order: Order, source: ReorderSource) => {
      // 'cart/replace' overwrites any cart in progress without asking.
      const discardedCartItemCount = cart.itemCount
      dispatch({
        type: 'cart/replace',
        restaurantId: order.restaurantId,
        lines: order.lines,
      })
      if (typeof pendo !== 'undefined') {
        pendo.track('reorder_completed', {
          originalOrderId: order.id,
          restaurantId: order.restaurantId,
          restaurantName: order.restaurantName,
          itemCount: order.lines.reduce((sum, l) => sum + l.qty, 0),
          originalOrderTotal: order.totals.total,
          source,
          discardedCartItemCount,
        })
      }
      notify(`${order.restaurantName} order added to your cart`)
      openCart()
    },
    [cart.itemCount, dispatch, notify, openCart],
  )
}
