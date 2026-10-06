import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Tile } from '../components/Tile'
import { getRestaurant } from '../data/restaurants'
import { clockTime, fee, money } from '../lib/format'
import { useOrder } from '../lib/store'
import {
  STAGES,
  minutesRemaining,
  progressAt,
  stageIndexAt,
} from '../lib/tracking'
import { useNow } from '../lib/useNow'
import { useReorder } from '../lib/useReorder'

/** Prevents re-firing the delivered event on page revisit. */
const deliveredOrderIds = new Set<string>()

export function TrackOrder() {
  const { orderId } = useParams()
  const order = useOrder(orderId)
  const reorder = useReorder()

  // Reading the clock here decides whether to keep ticking at all: a finished
  // order needs no interval.
  const isFinished = order
    ? Date.now() - order.placedAt >= STAGES[STAGES.length - 1].startsAt
    : false
  const now = useNow(1000, !isFinished)

  const isDeliveredNow = order
    ? stageIndexAt(order, now) === STAGES.length - 1
    : false

  useEffect(() => {
    if (!order || !isDeliveredNow) return
    if (deliveredOrderIds.has(order.id)) return
    deliveredOrderIds.add(order.id)
    if (typeof pendo !== 'undefined') {
      pendo.track('order_delivered', {
        orderId: order.id,
        restaurantId: order.restaurantId,
        restaurantName: order.restaurantName,
        fulfillment: order.fulfillment,
        total: order.totals.total,
        etaMinutes: order.etaMinutes,
        actualDurationMs: now - order.placedAt,
      })
    }
  }, [isDeliveredNow, order, now])

  if (!order) {
    return (
      <div className="page page--narrow">
        <EmptyState
          emoji="🔍"
          title="We couldn't find that order"
          description="Orders live in this browser only, so they disappear if you clear site data."
          action={
            <Link to="/" className="button">
              Back to browse
            </Link>
          }
        />
      </div>
    )
  }

  const stageIndex = stageIndexAt(order, now)
  const progress = progressAt(order, now)
  const remaining = minutesRemaining(order, now)
  const delivered = stageIndex === STAGES.length - 1
  const isDelivery = order.fulfillment === 'delivery'
  const gradient = getRestaurant(order.restaurantId)?.gradient ?? [
    '#e5e7eb',
    '#9ca3af',
  ]
  // Keep the rider inside the track instead of half hanging off each end.
  const courierPosition = 3 + progress * 94

  return (
    <div className="page page--narrow stack">
      <section className="track-hero">
        <div className="row row--between">
          <div>
            <p className="muted">Order {order.id}</p>
            <h1 className="track-hero__eta">
              {delivered
                ? STAGES[stageIndex].label[order.fulfillment]
                : `${remaining} min away`}
            </h1>
            <p className="muted">
              {delivered
                ? `Placed at ${clockTime(order.placedAt)}`
                : STAGES[stageIndex].detail[order.fulfillment]}
            </p>
          </div>
          <Tile
            emoji={order.restaurantEmoji}
            gradient={gradient}
            className="order-row__tile"
          />
        </div>

        <div className="track-progress">
          <div
            className="track-progress__fill"
            style={{ width: `${progress * 100}%` }}
          />
          <span
            className="track-progress__courier"
            style={{ left: `${courierPosition}%` }}
            aria-hidden="true"
          >
            {delivered ? '🏠' : isDelivery ? '🛵' : '👨‍🍳'}
          </span>
        </div>

        {isDelivery && (
          <div className="courier-card">
            <span className="courier-card__avatar" aria-hidden="true">
              🧑‍🦰
            </span>
            <div>
              <strong>{order.courier}</strong>
              <p className="muted">
                {delivered
                  ? 'Dropped off your order'
                  : 'Your courier for this delivery'}
              </p>
            </div>
          </div>
        )}

        {delivered && (
          <div className="row">
            <button type="button" className="button" onClick={() => reorder(order)}>
              Order this again
            </button>
            <Link to="/" className="button button--secondary">
              Browse restaurants
            </Link>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__body">
          <h2 style={{ marginBottom: 8 }}>Progress</h2>
          <ol className="stage-list">
            {STAGES.map((stage, index) => {
              const state =
                index < stageIndex
                  ? 'is-done'
                  : index === stageIndex
                    ? 'is-current'
                    : 'is-pending'

              return (
                <li key={stage.id} className={`stage ${state}`}>
                  <span className="stage__marker" aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <p className="stage__label">
                      {stage.label[order.fulfillment]}
                    </p>
                    <p className="stage__detail">
                      {stage.detail[order.fulfillment]}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <section className="card">
        <div className="card__body stack">
          <div className="row row--between">
            <h2>{order.restaurantName}</h2>
            <span className="badge">
              {isDelivery ? 'Delivery' : 'Pickup'}
            </span>
          </div>

          <div className="summary-lines">
            {order.lines.map((line) => (
              <div key={line.itemId} className="summary-line">
                <span>
                  <span className="summary-line__qty">{line.qty}×</span> {line.name}
                </span>
                <span>{money(line.price * line.qty)}</span>
              </div>
            ))}
          </div>

          <div className="totals">
            <div className="totals__row">
              <span>Subtotal</span>
              <span>{money(order.totals.subtotal)}</span>
            </div>
            <div className="totals__row">
              <span>Delivery</span>
              <span>{fee(order.totals.deliveryFee)}</span>
            </div>
            <div className="totals__row">
              <span>Service fee</span>
              <span>{money(order.totals.serviceFee)}</span>
            </div>
            {isDelivery && (
              <div className="totals__row">
                <span>Tip</span>
                <span>{money(order.totals.tip)}</span>
              </div>
            )}
            <div className="totals__row totals__row--total">
              <span>Total</span>
              <span>{money(order.totals.total)}</span>
            </div>
          </div>

          <p className="muted">{order.address}</p>
        </div>
      </section>
    </div>
  )
}
