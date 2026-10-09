import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cuisines, restaurants } from '../data/restaurants'
import type { Restaurant } from '../data/restaurants'
import { RestaurantCard } from '../components/RestaurantCard'
import { EmptyState } from '../components/EmptyState'

type SortKey = 'recommended' | 'fastest' | 'cheapest'

/** How a search was run, for `restaurant_search_executed`. */
type SearchTrigger = 'typing' | 'button' | 'enter'

/** The control that changed the list, for `restaurant_filters_applied`. */
type FilterChange = 'cuisine' | 'free_delivery' | 'sort' | 'clear_filters'

/** Results filter as you type, so a pause this long counts as a search. */
const SEARCH_PAUSE_MS = 1000

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recommended', label: 'Top rated' },
  { key: 'fastest', label: 'Fastest' },
  { key: 'cheapest', label: 'Lowest delivery fee' },
]

/** Matches the name, the cuisine, or any dish on the menu. */
function matchesQuery(restaurant: Restaurant, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  if (
    restaurant.name.toLowerCase().includes(needle) ||
    restaurant.cuisine.toLowerCase().includes(needle)
  ) {
    return true
  }

  return restaurant.menu.some((section) =>
    section.items.some((item) => item.name.toLowerCase().includes(needle)),
  )
}

function sortRestaurants(list: Restaurant[], sort: SortKey): Restaurant[] {
  const sorted = [...list]
  switch (sort) {
    case 'fastest':
      return sorted.sort((a, b) => a.eta[0] - b.eta[0])
    case 'cheapest':
      return sorted.sort((a, b) => a.deliveryFee - b.deliveryFee)
    default:
      return sorted.sort((a, b) => b.rating - a.rating)
  }
}

export function Browse() {
  const [query, setQuery] = useState('')
  const [cuisine, setCuisine] = useState<string | null>(null)
  const [freeDeliveryOnly, setFreeDeliveryOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('recommended')

  const results = useMemo(() => {
    const filtered = restaurants.filter(
      (restaurant) =>
        matchesQuery(restaurant, query) &&
        (!cuisine || restaurant.cuisine === cuisine) &&
        (!freeDeliveryOnly || restaurant.deliveryFee === 0),
    )
    return sortRestaurants(filtered, sort)
  }, [query, cuisine, freeDeliveryOnly, sort])

  /** The last search sent to Pendo, so the same query isn't tracked twice. */
  const lastTrackedQuery = useRef<string | null>(null)

  const trackSearch = useCallback(
    (trigger: SearchTrigger) => {
      const trimmed = query.trim()
      if (!trimmed || trimmed === lastTrackedQuery.current) return
      lastTrackedQuery.current = trimmed
      if (typeof pendo !== 'undefined') {
        pendo.track('restaurant_search_executed', {
          query: trimmed.slice(0, 100),
          queryLength: trimmed.length,
          cuisineFilter: cuisine ?? 'all',
          freeDeliveryOnly,
          sortKey: sort,
          resultsCount: results.length,
          trigger,
        })
      }
    },
    [query, cuisine, freeDeliveryOnly, sort, results.length],
  )

  // There's no submit step, so a pause in typing is what runs a search.
  useEffect(() => {
    if (!query.trim()) {
      // An emptied box starts over: searching the same thing again counts.
      lastTrackedQuery.current = null
      return
    }
    const id = window.setTimeout(() => trackSearch('typing'), SEARCH_PAUSE_MS)
    return () => window.clearTimeout(id)
  }, [query, trackSearch])

  /** Set by a filter control, then tracked once `results` reflects it. */
  const pendingFilterChange = useRef<FilterChange | null>(null)

  useEffect(() => {
    const filterChanged = pendingFilterChange.current
    if (!filterChanged) return
    pendingFilterChange.current = null
    if (typeof pendo !== 'undefined') {
      pendo.track('restaurant_filters_applied', {
        filterChanged,
        cuisineFilter: cuisine ?? 'all',
        freeDeliveryOnly,
        sortKey: sort,
        query: query.trim().slice(0, 100),
        resultsCount: results.length,
      })
    }
  }, [cuisine, freeDeliveryOnly, sort, query, results.length])

  const selectCuisine = (next: string | null) => {
    // Re-clicking the active chip changes nothing, so there's nothing to track.
    if (next === cuisine) return
    pendingFilterChange.current = 'cuisine'
    setCuisine(next)
  }

  const toggleFreeDelivery = () => {
    pendingFilterChange.current = 'free_delivery'
    setFreeDeliveryOnly((value) => !value)
  }

  const changeSort = (next: SortKey) => {
    pendingFilterChange.current = 'sort'
    setSort(next)
  }

  const clearFilters = () => {
    // Count a zero-result search the user gave up on before typing paused.
    trackSearch('typing')
    pendingFilterChange.current = 'clear_filters'
    setQuery('')
    setCuisine(null)
    setFreeDeliveryOnly(false)
  }

  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">
          <span aria-hidden="true">📍</span> Delivering to 24 Alder St
        </span>
        <h1 className="hero__title">What are you hungry for tonight?</h1>
        <div className="hero__search">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                trackSearch('enter')
              }
            }}
            placeholder="Search restaurants or dishes"
            aria-label="Search restaurants or dishes"
          />
          <button
            type="button"
            className="button"
            onClick={() => trackSearch('button')}
          >
            Search
          </button>
        </div>
      </section>

      <div className="filters">
        <div className="filters__chips">
          <button
            type="button"
            className={`chip${cuisine === null ? ' is-active' : ''}`}
            onClick={() => selectCuisine(null)}
          >
            All
          </button>
          {cuisines.map((name) => (
            <button
              key={name}
              type="button"
              className={`chip${cuisine === name ? ' is-active' : ''}`}
              onClick={() => selectCuisine(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="filters__spacer" />

        <button
          type="button"
          className={`chip${freeDeliveryOnly ? ' is-active' : ''}`}
          aria-pressed={freeDeliveryOnly}
          onClick={toggleFreeDelivery}
        >
          Free delivery
        </button>

        <label className="visually-hidden" htmlFor="sort">
          Sort restaurants
        </label>
        <select
          id="sort"
          className="select"
          value={sort}
          onChange={(event) => changeSort(event.target.value as SortKey)}
        >
          {SORTS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="section-heading">
        <h2>
          {results.length} {results.length === 1 ? 'restaurant' : 'restaurants'}
        </h2>
        <span className="muted">Prices include taxes</span>
      </div>

      {results.length === 0 ? (
        <EmptyState
          emoji="🍽️"
          title="Nothing matched that search"
          description="Try a different dish, or clear your filters to see everything."
          action={
            <button type="button" className="button" onClick={clearFilters}>
              Clear filters
            </button>
          }
        />
      ) : (
        // Opening a result before typing pauses still counts as the search.
        <div
          className="restaurant-grid"
          onClickCapture={() => trackSearch('typing')}
        >
          {results.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>
      )}
    </div>
  )
}
