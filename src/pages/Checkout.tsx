import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getRestaurant } from '../data/restaurants'
import { Tile } from '../components/Tile'
import { fee, formatCardNumber, formatExpiry, money } from '../lib/format'
import {
  computeTotals,
  newOrderId,
  useCart,
  useStoreDispatch,
} from '../lib/store'
import type { Fulfillment, Order } from '../lib/store'
import { pickCourier } from '../lib/tracking'
import { useUI } from '../lib/ui'

type Form = {
  name: string
  street: string
  apt: string
  city: string
  zip: string
  notes: string
  card: string
  expiry: string
  cvc: string
}

type Errors = Partial<Record<keyof Form, string>>

const emptyForm: Form = {
  name: '',
  street: '',
  apt: '',
  city: '',
  zip: '',
  notes: '',
  card: '',
  expiry: '',
  cvc: '',
}

const demoForm: Form = {
  name: 'Rebecca Planchart',
  street: '24 Alder St',
  apt: 'Apt 3B',
  city: 'Brooklyn',
  zip: '11222',
  notes: 'Leave at the door, please.',
  card: '4242 4242 4242 4242',
  expiry: '11/29',
  cvc: '123',
}

const TIPS = [0, 0.1, 0.15, 0.2]

function validate(form: Form, fulfillment: Fulfillment): Errors {
  const errors: Errors = {}
  const digits = (value: string) => value.replace(/\D/g, '')

  if (!form.name.trim()) errors.name = 'Add a name for the order.'

  if (fulfillment === 'delivery') {
    if (!form.street.trim()) errors.street = 'Add a street address.'
    if (!form.city.trim()) errors.city = 'Add a city.'
    if (digits(form.zip).length !== 5) errors.zip = 'Use a 5-digit ZIP code.'
  }

  if (digits(form.card).length !== 16) errors.card = 'Enter all 16 digits.'
  if (digits(form.expiry).length !== 4) errors.expiry = 'Use MM/YY.'
  if (digits(form.cvc).length < 3) errors.cvc = 'Enter the 3-digit code.'

  return errors
}

export function Checkout() {
  const cart = useCart()
  const dispatch = useStoreDispatch()
  const { notify } = useUI()

  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery')
  const [tipPercent, setTipPercent] = useState(0.15)
  const [form, setForm] = useState<Form>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [placing, setPlacing] = useState(false)
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null)

  const restaurant = getRestaurant(cart.restaurantId ?? undefined)

  // Placing an order empties the cart, so this redirect has to be checked
  // before the empty-cart guard below or the two would fight each other.
  if (placedOrderId) return <Navigate to={`/track/${placedOrderId}`} replace />

  // Nothing to check out: send people back to browse rather than showing
  // an empty form.
  if (cart.isEmpty || !restaurant) return <Navigate to="/" replace />

  const totals = computeTotals(
    cart.subtotal,
    restaurant,
    fulfillment,
    tipPercent,
  )

  const update = (key: keyof Form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const placeOrder = () => {
    const nextErrors = validate(form, fulfillment)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      if (typeof pendo !== 'undefined') {
        pendo.track('checkout_validation_failed', {
          errorFields: Object.keys(nextErrors),
          errorCount: Object.keys(nextErrors).length,
          fulfillment,
          restaurantId: restaurant.id,
          itemCount: cart.itemCount,
          subtotal: cart.subtotal,
        })
      }
      notify('Check the highlighted fields')
      return
    }

    setPlacing(true)

    const order: Order = {
      id: newOrderId(),
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantEmoji: restaurant.emoji,
      lines: cart.lines,
      totals,
      fulfillment,
      address:
        fulfillment === 'pickup'
          ? `Pickup at ${restaurant.name}`
          : [form.street, form.apt, form.city, form.zip]
              .filter(Boolean)
              .join(', '),
      courier: pickCourier(),
      placedAt: Date.now(),
      etaMinutes: restaurant.eta[1],
    }

    // A beat of latency so the button state reads as a real submission.
    window.setTimeout(() => {
      if (typeof pendo !== 'undefined') {
        pendo.track('order_placed', {
          orderId: order.id,
          restaurantId: order.restaurantId,
          restaurantName: order.restaurantName,
          fulfillment: order.fulfillment,
          itemCount: order.lines.reduce((sum, l) => sum + l.qty, 0),
          uniqueItemCount: order.lines.length,
          subtotal: order.totals.subtotal,
          deliveryFee: order.totals.deliveryFee,
          serviceFee: order.totals.serviceFee,
          tip: order.totals.tip,
          total: order.totals.total,
          // Pickup has no tip, but the tip chips keep their last selection.
          tipPercent:
            order.fulfillment === 'pickup' ? 0 : Math.round(tipPercent * 100),
          etaMinutes: order.etaMinutes,
          cuisine: restaurant.cuisine,
        })
      }
      dispatch({ type: 'order/place', order })
      setPlacedOrderId(order.id)
    }, 550)
  }

  return (
    <div className="page">
      <div className="section-heading">
        <h1>Checkout</h1>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => {
            setForm(demoForm)
            setErrors({})
          }}
        >
          Fill demo details
        </button>
      </div>

      <div className="checkout">
        <div className="stack">
          <section className="card">
            <div className="card__body stack">
              <h2>How do you want it?</h2>
              <div className="segmented" role="group" aria-label="Fulfillment">
                {(['delivery', 'pickup'] as Fulfillment[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`segmented__option${
                      fulfillment === option ? ' is-active' : ''
                    }`}
                    aria-pressed={fulfillment === option}
                    onClick={() => setFulfillment(option)}
                  >
                    {option === 'delivery' ? '🛵 Delivery' : '🏃 Pickup'}
                  </button>
                ))}
              </div>
              <p className="muted">
                {fulfillment === 'delivery'
                  ? `Arrives in about ${restaurant.eta[0]}–${restaurant.eta[1]} minutes.`
                  : `Ready for pickup at ${restaurant.name} in about ${restaurant.eta[0]} minutes.`}
              </p>
            </div>
          </section>

          <section className="card">
            <div className="card__body stack">
              <h2>
                {fulfillment === 'delivery'
                  ? 'Delivery address'
                  : 'Your details'}
              </h2>

              <div className="field-grid">
                <div className="field field--span">
                  <label className="field__label" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    className="input"
                    value={form.name}
                    onChange={(event) => update('name', event.target.value)}
                    aria-invalid={Boolean(errors.name)}
                    autoComplete="name"
                  />
                  {errors.name && (
                    <span className="field__error">{errors.name}</span>
                  )}
                </div>

                {fulfillment === 'delivery' && (
                  <>
                    <div className="field">
                      <label className="field__label" htmlFor="street">
                        Street address
                      </label>
                      <input
                        id="street"
                        className="input"
                        value={form.street}
                        onChange={(event) =>
                          update('street', event.target.value)
                        }
                        aria-invalid={Boolean(errors.street)}
                        autoComplete="address-line1"
                      />
                      {errors.street && (
                        <span className="field__error">{errors.street}</span>
                      )}
                    </div>

                    <div className="field">
                      <label className="field__label" htmlFor="apt">
                        Apt or floor
                      </label>
                      <input
                        id="apt"
                        className="input"
                        value={form.apt}
                        onChange={(event) => update('apt', event.target.value)}
                        placeholder="Optional"
                        autoComplete="address-line2"
                      />
                    </div>

                    <div className="field">
                      <label className="field__label" htmlFor="city">
                        City
                      </label>
                      <input
                        id="city"
                        className="input"
                        value={form.city}
                        onChange={(event) => update('city', event.target.value)}
                        aria-invalid={Boolean(errors.city)}
                        autoComplete="address-level2"
                      />
                      {errors.city && (
                        <span className="field__error">{errors.city}</span>
                      )}
                    </div>

                    <div className="field">
                      <label className="field__label" htmlFor="zip">
                        ZIP code
                      </label>
                      <input
                        id="zip"
                        className="input"
                        inputMode="numeric"
                        value={form.zip}
                        onChange={(event) =>
                          update(
                            'zip',
                            event.target.value.replace(/\D/g, '').slice(0, 5),
                          )
                        }
                        aria-invalid={Boolean(errors.zip)}
                        autoComplete="postal-code"
                      />
                      {errors.zip && (
                        <span className="field__error">{errors.zip}</span>
                      )}
                    </div>

                    <div className="field field--span">
                      <label className="field__label" htmlFor="notes">
                        Delivery notes
                      </label>
                      <input
                        id="notes"
                        className="input"
                        value={form.notes}
                        onChange={(event) =>
                          update('notes', event.target.value)
                        }
                        placeholder="Buzzer code, gate, where to leave it"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {fulfillment === 'delivery' && (
            <section className="card">
              <div className="card__body stack">
                <h2>Tip your courier</h2>
                <div className="tip-options">
                  {TIPS.map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      className={`chip${tipPercent === percent ? ' is-active' : ''}`}
                      aria-pressed={tipPercent === percent}
                      onClick={() => setTipPercent(percent)}
                    >
                      {percent === 0
                        ? 'No tip'
                        : `${Math.round(percent * 100)}% · ${money(
                            Math.round(cart.subtotal * percent),
                          )}`}
                    </button>
                  ))}
                </div>
                <p className="field__hint">
                  100% of the tip goes to your courier.
                </p>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card__body stack">
              <h2>Payment</h2>
              <div className="notice">
                <span aria-hidden="true">🧪</span>
                <span>
                  Demo app: no card is charged and nothing is sent anywhere. Use
                  any test number.
                </span>
              </div>

              <div className="field-grid field-grid--three">
                <div className="field field--span">
                  <label className="field__label" htmlFor="card">
                    Card number
                  </label>
                  <input
                    id="card"
                    className="input"
                    inputMode="numeric"
                    placeholder="4242 4242 4242 4242"
                    value={form.card}
                    onChange={(event) =>
                      update('card', formatCardNumber(event.target.value))
                    }
                    aria-invalid={Boolean(errors.card)}
                  />
                  {errors.card && (
                    <span className="field__error">{errors.card}</span>
                  )}
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="expiry">
                    Expiry
                  </label>
                  <input
                    id="expiry"
                    className="input"
                    inputMode="numeric"
                    placeholder="MM/YY"
                    value={form.expiry}
                    onChange={(event) =>
                      update('expiry', formatExpiry(event.target.value))
                    }
                    aria-invalid={Boolean(errors.expiry)}
                  />
                  {errors.expiry && (
                    <span className="field__error">{errors.expiry}</span>
                  )}
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="cvc">
                    CVC
                  </label>
                  <input
                    id="cvc"
                    className="input"
                    inputMode="numeric"
                    placeholder="123"
                    value={form.cvc}
                    onChange={(event) =>
                      update(
                        'cvc',
                        event.target.value.replace(/\D/g, '').slice(0, 4),
                      )
                    }
                    aria-invalid={Boolean(errors.cvc)}
                  />
                  {errors.cvc && (
                    <span className="field__error">{errors.cvc}</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="card checkout__summary">
          <div className="card__body stack">
            <div className="row">
              <Tile
                emoji={restaurant.emoji}
                gradient={restaurant.gradient}
                className="cart-line__tile"
              />
              <div>
                <h3>{restaurant.name}</h3>
                <p className="muted">
                  {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>

            <div className="summary-lines">
              {cart.lines.map((line) => (
                <div key={line.itemId} className="summary-line">
                  <span>
                    <span className="summary-line__qty">{line.qty}×</span>{' '}
                    {line.name}
                  </span>
                  <span>{money(line.price * line.qty)}</span>
                </div>
              ))}
            </div>

            <div className="totals">
              <div className="totals__row">
                <span>Subtotal</span>
                <span>{money(totals.subtotal)}</span>
              </div>
              <div className="totals__row">
                <span>Delivery</span>
                <span>{fee(totals.deliveryFee)}</span>
              </div>
              <div className="totals__row">
                <span>Service fee</span>
                <span>{money(totals.serviceFee)}</span>
              </div>
              {fulfillment === 'delivery' && (
                <div className="totals__row">
                  <span>Tip</span>
                  <span>{money(totals.tip)}</span>
                </div>
              )}
              <div className="totals__row totals__row--total">
                <span>Total</span>
                <span>{money(totals.total)}</span>
              </div>
            </div>

            <button
              type="button"
              className="button button--block button--lg"
              onClick={placeOrder}
              disabled={placing}
            >
              {placing
                ? 'Placing order…'
                : `Place order · ${money(totals.total)}`}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
