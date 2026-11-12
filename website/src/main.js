import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'
import { places } from './data/places.js'
import { trips } from './data/trips.js'
import { hikes } from './data/hikes.js'
import { milesDrivenByTrip } from './data/miles.js'
import { booksRead } from './data/books.js'
import { moviesWatched } from './data/movies.js'
import { renderOverviewMap, renderTripMaps } from './mapViews.js'

document.querySelector('#app').innerHTML = `
  <header class="hero">
    <nav>
      <span class="logo">THE SIX-MONTH EXPERIMENT</span>
      <span class="edition">VOL. 01 / 2026</span>
    </nav>

    <div class="hero-content">
      <p class="eyebrow">A PERSONAL DATA JOURNAL</p>
      <h1>Six months.</h1>
      <p class="intro">
        Places traveled, money spent, steps taken, memories made and people met
      </p>
      <a href="#explore" class="explore">EXPLORE THE EXPERIMENT ↓</a>
    </div>
  </header>

  <main id="explore">
    <section class="chapter">
      <p class="eyebrow">CHAPTER 01</p>
      <h2>A life in motion.</h2>
      <p>Every stop, all together.</p>

      <div class="map-section">
        <div class="map-heading">
          <p class="eyebrow">THE SCRATCH MAP</p>
          <h3>Places collected.</h3>
        </div>
        <div class="overview-stat-groups" id="overview-stats"></div>
        <div class="map-viewport">
          <div id="overview-map" aria-label="Overview map of all visited places"></div>
        </div>
        <div class="route-legend" aria-label="Transportation modes">
          <div class="route-legend-item">
            <span class="route-legend-state" aria-hidden="true"></span>
            <span>Visited state</span>
          </div>
          <div class="route-legend-item">
            <span class="route-legend-park route-legend-national" aria-hidden="true"></span>
            <span>National park</span>
          </div>
          <div class="route-legend-item">
            <span class="route-legend-park route-legend-other" aria-hidden="true"></span>
            <span>Other park</span>
          </div>
        </div>
      </div>
    </section>

    <section class="chapter trip-chapter">
      <p class="eyebrow">THE TRIPS</p>
      <h2>One departure at a time.</h2>
      <div id="trip-maps"></div>
    </section>

    <section class="chapter media-chapter">
      <p class="eyebrow">CHAPTER 02</p>
      <h2>Books read and movies watched.</h2>
      <div class="media-summary" id="media-summary"></div>
      <div class="media-columns">
        <section class="media-log" aria-labelledby="books-heading">
          <header>
            <h3 id="books-heading">Books read</h3>
            <span id="book-count">0</span>
          </header>
          <ul class="media-record-list" id="book-list"></ul>
          <p class="media-empty" id="books-empty">No books imported yet.</p>
        </section>
        <section class="media-log" aria-labelledby="movies-heading">
          <header>
            <h3 id="movies-heading">Movies watched</h3>
            <span id="movie-count">0</span>
          </header>
          <ul class="media-record-list" id="movie-list"></ul>
          <p class="media-empty" id="movies-empty">No movies imported yet.</p>
        </section>
      </div>
    </section>

    <section class="chapter">
      <p class="eyebrow">CHAPTER 03</p>
      <h2>Money.</h2>
      <p>Money spent</p>
    </section>

    <section class="chapter">
      <p class="eyebrow">CHAPTER 04</p>
      <h2>Steps taken.</h2>
      <p>Six months of movement, activity and everyday life.</p>
    </section>
  </main>

  <footer>A little less work. A lot more curiosity.</footer>
`

const orderedPlaces = [...places].sort((a, b) => a.date.localeCompare(b.date))
const dayInMilliseconds = 24 * 60 * 60 * 1000
const getNights = (start, end) => Math.round(
  (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / dayInMilliseconds
)
const formatDate = date => new Date(`${date}T12:00:00`).toLocaleDateString(
  'en-US',
  { day: 'numeric', month: 'short', year: 'numeric' }
)
const uniqueValues = values => new Set(values.filter(Boolean))
const otherParkKinds = new Set([
  'state-park',
  'national-monument',
  'foreign-national-park',
  'foreign-provincial-park'
])
const getParkCount = (records, predicate) => uniqueValues(
  records.filter(predicate).map(place => `${place.kind}:${place.city}`)
).size

const tripPlans = trips.map(trip => {
  const origin = orderedPlaces.find(place => place.id === trip.originId)
  const visits = orderedPlaces.filter(place => place.date >= trip.start && place.date <= trip.end)
  const departure = {
    ...origin,
    date: trip.start,
    transportFromPrevious: null,
    note: 'Departing from San Francisco'
  }

  return {
    ...trip,
    visits,
    stops: [departure, ...visits],
    nightsAway: getNights(trip.start, trip.end)
  }
})

const cities = uniqueValues(orderedPlaces.map(place => `${place.city}, ${place.country}`))
const countries = uniqueValues(orderedPlaces.map(place => place.country))
const states = uniqueValues(orderedPlaces.map(place => place.state))
const flights = orderedPlaces.filter(place => place.transportFromPrevious === 'flying').length
const nationalParks = getParkCount(orderedPlaces, place => place.kind === 'national-park')
const otherParks = getParkCount(orderedPlaces, place => otherParkKinds.has(place.kind))
const nightsAway = tripPlans.reduce((total, trip) => total + trip.nightsAway, 0)
const milesValues = tripPlans.map(trip => milesDrivenByTrip[trip.id])
const totalMiles = milesValues.every(Number.isFinite)
  ? milesValues.reduce((total, miles) => total + miles, 0)
  : null

const overviewStats = [
  ['Times I Packed My Bags', trips.length],
  ['Cities', cities.size],
  ['Countries', countries.size],
  ['US States', states.size],
  ['US National Parks', nationalParks],
  ['Other Parks', otherParks],
  ['Hikes Done', hikes.length ? hikes.length : null],
  ['Flights', flights],
  ['Miles Driven', totalMiles],
  ['Nights Away from SF', nightsAway]
]

const overviewStatGroups = [
  { title: 'Footprint', stats: overviewStats.slice(0, 4) },
  { title: 'Parks & Trails', stats: overviewStats.slice(4, 7) },
  { title: 'Getting Around', stats: overviewStats.slice(7, 10) }
]

const displayStat = value => value === null ? '—' : Number(value).toLocaleString()
const renderStats = stats => stats.map(([label, value]) => `
  <div class="stat-item">
    <strong>${displayStat(value)}</strong>
    <span>${label}</span>
  </div>
`).join('')

document.getElementById('overview-stats').innerHTML = overviewStatGroups.map(group => `
  <section class="overview-stat-group">
    <h4>${group.title}</h4>
    <div class="overview-stat-items">${renderStats(group.stats)}</div>
  </section>
`).join('')

const getTripStats = trip => {
  const tripHikes = hikes.filter(hike => hike.tripId === trip.id).length
  const miles = milesDrivenByTrip[trip.id]
  const tripFlights = trip.visits.filter(place => place.transportFromPrevious === 'flying').length

  return [
    ['Destinations', trip.visits.length],
    ['Days', trip.nightsAway + 1],
    ['Nights Away', trip.nightsAway],
    ['Flights', tripFlights],
    ['National Parks', getParkCount(trip.visits, place => place.kind === 'national-park')],
    ['Other Parks', getParkCount(trip.visits, place => otherParkKinds.has(place.kind))],
    ['Hikes', hikes.length ? tripHikes : null],
    ['Miles Driven', Number.isFinite(miles) ? miles : null]
  ].filter(([, value]) => Number.isFinite(value) && value > 0)
}

document.getElementById('trip-maps').innerHTML = tripPlans.map((trip, index) => `
  <article class="trip-map-entry" data-trip-index="${index}">
    <header class="trip-map-heading">
      <p class="eyebrow">TRIP ${String(index + 1).padStart(2, '0')} · ${formatDate(trip.start)}${trip.start === trip.end ? '' : ` – ${formatDate(trip.end)}`}</p>
      <h3>${trip.title}</h3>
    </header>
    <div class="trip-stats">${renderStats(getTripStats(trip))}</div>
    <div class="trip-map-viewport">
      <div class="trip-map" id="trip-map-${trip.id}" aria-label="Map for ${trip.title}"></div>
      <div class="trip-player" data-trip-player data-trip-index="${index}" aria-label="Journey through ${trip.title}">
        <div class="trip-player-head">
          <span class="trip-player-title">${trip.title}</span>
          <span class="trip-player-count" data-trip-count>${trip.stops.length} stops</span>
        </div>
        <div class="trip-player-progress" aria-hidden="true"><span data-trip-progress></span></div>
        <p class="trip-player-meta" data-trip-meta>START HERE · ${formatDate(trip.start)}</p>
        <h4 data-trip-place>${trip.stops[0].city}, ${trip.stops[0].country}</h4>
        <p class="trip-player-note" data-trip-note>Departing from San Francisco</p>
        <p class="trip-player-mode" data-trip-mode>Trip departure</p>
        <button class="trip-player-start" data-trip-start type="button">Start trip</button>
        <div class="trip-player-controls" data-trip-controls hidden>
          <button data-trip-previous type="button" aria-label="Previous stop" title="Previous stop">←</button>
          <button data-trip-next type="button" aria-label="Next stop" title="Next stop">→</button>
          <button data-trip-restart type="button" hidden>Start again</button>
        </div>
      </div>
    </div>
  </article>
`).join('')

renderOverviewMap(maplibregl, orderedPlaces)
renderTripMaps(maplibregl, tripPlans)

const mediaSummary = [
  ['Books Read', booksRead.length],
  ['Movies Watched', moviesWatched.length]
]
document.getElementById('media-summary').innerHTML = renderStats(mediaSummary)
document.getElementById('book-count').textContent = booksRead.length
document.getElementById('movie-count').textContent = moviesWatched.length

const renderMediaList = (listId, emptyId, records, getTitle, getDetail) => {
  const list = document.getElementById(listId)
  const empty = document.getElementById(emptyId)
  empty.hidden = records.length > 0

  records.forEach(record => {
    const item = document.createElement('li')
    const title = document.createElement('strong')
    title.textContent = getTitle(record)
    const detail = document.createElement('span')
    detail.textContent = getDetail(record)
    item.append(title, detail)
    list.append(item)
  })
}

renderMediaList(
  'book-list',
  'books-empty',
  booksRead,
  book => book.title,
  book => [book.author, book.dateRead, book.rating ? `${book.rating}/5` : null]
    .filter(Boolean)
    .join(' · ')
)

renderMediaList(
  'movie-list',
  'movies-empty',
  moviesWatched,
  movie => movie.title,
  movie => [movie.watchedAt, movie.theater, movie.format]
    .filter(Boolean)
    .join(' · ')
)