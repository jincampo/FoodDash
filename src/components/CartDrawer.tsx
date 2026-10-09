import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getRestaurant } from '../data/restaurants'
import { fee, money } from '../lib/format'
import { useCart, useStoreDispatch } from '../lib/store'
import { useUI } from '../lib/ui'
import { EmptyState } from './EmptyState'
import { QuantityStepper } from './QuantityStepper'
import { Tile } from './Tile'

export function CartDrawer() {
  const { cartOpen, closeCart } = useUI()
  const cart = useCart()
  const dispatch = useStoreDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const restaurant = getRestaurant(cart.restaurantId ?? undefined)

  useEffect(() => {
    if (!cartOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCart()
    }
    window.addEventListener('keydown', onKeyDown)

    // Stop the page behind the drawer from scrolling.
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
    }
  }, [cartOpen, closeCart])

  if (!cartOpen) return null

  const goToCheckout = () => {
    closeCart()
    navigate('/checkout')
  }

  const alreadyCheckingOut = location.pathname === '/checkout'

  return (
    <>
      <div className="overlay" onClick={closeCart} />
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
      >
        <div className="drawer__header">
          <div>
            <h2 id="cart-title">Your cart</h2>
            {restaurant && <p className="muted">{restaurant.name}</p>}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={closeCart}
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        <div className="drawer__body">
          {cart.isEmpty ? (
            <EmptyState
              emoji="🛒"
              title="Your cart is empty"
              description="Add a few dishes and they'll show up here."
              action={
                <button type="button" className="button" onClick={closeCart}>
                  Browse restaurants
                </button>
              }
            />
          ) : (
            <ul className="cart-lines">
              {cart.lines.map((line) => (
                <li key={line.itemId} className="cart-line">
                  <Tile
                    emoji={line.emoji}
                    gradient={restaurant?.gradient ?? ['#e5e7eb', '#9ca3af']}
                    className="cart-line__tile"
                  />
                  <div className="cart-line__text">
                    <p className="cart-line__name">{line.name}</p>
                    <p className="cart-line__price">
                      {money(line.price * line.qty)}
                    </p>
                  </div>
                  <QuantityStepper
                    quantity={line.qty}
                    itemName={line.name}
                    onChange={(qty) => {
                      if (qty === 0 && typeof pendo !== 'undefined') {
                        pendo.track('item_removed_from_cart', {
                          restaurantId: cart.restaurantId,
                          restaurantName: restaurant?.name,
                          itemId: line.itemId,
                          itemName: line.name,
                          itemPrice: line.price,
                          quantityBeforeRemoval: line.qty,
                          source: 'cart_drawer',
                        })
                      }
                      if (qty > 0 && typeof pendo !== 'undefined') {
                        pendo.track('cart_item_quantity_changed', {
                          restaurantId: cart.restaurantId,
                          itemId: line.itemId,
                          itemName: line.name,
                          itemPrice: line.price,
                          previousQuantity: line.qty,
                          newQuantity: qty,
                          source: 'cart_drawer',
                        })
                      }
                      dispatch({
                        type: 'cart/setQty',
                        itemId: line.itemId,
                        qty,
                      })
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {!cart.isEmpty && (
          <div className="drawer__footer stack">
            <div className="totals">
              <div className="totals__row">
                <span>Subtotal</span>
                <span>{money(cart.subtotal)}</span>
              </div>
              <div className="totals__row">
                <span>Delivery</span>
                <span>{fee(restaurant?.deliveryFee ?? 0)}</span>
              </div>
            </div>
            {alreadyCheckingOut ? (
              <button
                type="button"
                className="button button--block button--lg"
                onClick={closeCart}
              >
                Back to checkout
              </button>
            ) : (
              <button
                type="button"
                className="button button--block button--lg"
                onClick={goToCheckout}
              >
                Go to checkout
              </button>
            )}
            <button
              type="button"
              className="button button--ghost button--block"
              onClick={() => {
                if (typeof pendo !== 'undefined') {
                  pendo.track('cart_cleared', {
                    restaurantId: cart.restaurantId,
                    restaurantName: restaurant?.name,
                    itemCount: cart.itemCount,
                    subtotal: cart.subtotal,
                  })
                }
                dispatch({ type: 'cart/clear' })
              }}
            >
              Empty cart
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
