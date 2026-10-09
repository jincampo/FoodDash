import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Tile } from '../components/Tile'
import { getRestaurant } from '../data/restaurants'
import { dayAndTime, money } from '../lib/format'
import { useCart, useOrders, useStoreDispatch } from '../lib/store'
import { STAGES, isDelivered, stageIndexAt } from '../lib/tracking'
import { useNow } from '../lib/useNow'
import { useReorder } from '../lib/useReorder'

export function Orders() {
  const orders = useOrders()
  const cart = useCart()
  const dispatch = useStoreDispatch()
  const reorder = useReorder()
  const now = useNow(2000, orders.length > 0)

  if (orders.length === 0) {
    return (
      <div className="page page--narrow">
        <h1 style={{ marginBottom: 18 }}>Your orders</h1>
        <EmptyState
          emoji="🧾"
          title="No orders yet"
          description="Place one and you'll be able to track it and reorder from here."
          action={
            <Link to="/" className="button">
              Find something to eat
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="page page--narrow">
      <div className="section-heading">
        <h1>Your orders</h1>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => {
            // Sent before the reset so the counts describe what gets wiped.
            if (typeof pendo !== 'undefined') {
              pendo.track('demo_data_reset', {
                ordersClearedCount: orders.length,
                inProgressOrdersCount: orders.filter(
                  (order) => !isDelivered(order, now),
                ).length,
                cartItemCount: cart.itemCount,
              })
            }
            dispatch({ type: 'demo/reset' })
          }}
        >
          Reset demo data
        </button>
      </div>

      <ul className="order-list">
        {orders.map((order) => {
          const stageIndex = stageIndexAt(order, now)
          const done = stageIndex === STAGES.length - 1
          const gradient = getRestaurant(order.restaurantId)?.gradient ?? [
            '#e5e7eb',
            '#9ca3af',
          ]

          return (
            <li key={order.id} className="card order-row">
              <Tile
                emoji={order.restaurantEmoji}
                gradient={gradient}
                className="order-row__tile"
              />

              <div className="order-row__text">
                <div className="row">
                  <strong>{order.restaurantName}</strong>
                  <span
                    className={`status-pill${done ? ' status-pill--done' : ''}`}
                  >
                    {STAGES[stageIndex].label[order.fulfillment]}
                  </span>
                </div>
                <p className="order-row__items">
                  {order.lines.map((line) => `${line.qty}× ${line.name}`).join(', ')}
                </p>
                <p className="muted" style={{ fontSize: '0.82rem' }}>
                  {dayAndTime(order.placedAt)} · {money(order.totals.total)} ·{' '}
                  {order.id}
                </p>
              </div>

              <div className="order-row__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => reorder(order, 'order_history')}
                >
                  Reorder
                </button>
                <Link to={`/track/${order.id}`} className="button button--ghost">
                  {done ? 'Details' : 'Track'}
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
