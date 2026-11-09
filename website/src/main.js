import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'
import { places } from './data/places.js'

document.querySelector('#app').innerHTML = `
  <header class="hero">
    <nav>
      <span class="logo">THE SIX-MONTH EXPERIMENT</span>
      <span class="edition">VOL. 01 / 2026</span>
    </nav>

    <div class="hero-content">
      <p class="eyebrow">A PERSONAL DATA JOURNAL</p>

      <h1>
        Six months.<br />
      </h1>

      <p class="intro">
        Places traveled, money spent, steps taken, memories made and people met
      </p>

      <a href="#explore" class="explore">
        EXPLORE THE EXPERIMENT ↓
      </a>
    </div>
  </header>

  <main id="explore">
    <section class="chapter">
      <p class="eyebrow">CHAPTER 01</p>
      <h2>A life in motion.</h2>
      <p>
        Where I've been
      </p>

<div class="map-section">
  <div class="map-heading">
    <p class="eyebrow">MY JOURNEY, MAPPED</p>
    <h3>Where I've been.</h3>
    <p>Every destination, in chronological order.</p>
  </div>

  <div class="map-stats">
    <div>
      <strong id="city-count">0</strong>
      <span>Cities</span>
    </div>

    <div>
      <strong id="country-count">0</strong>
      <span>Countries</span>
    </div>

    <div>
      <strong id="distance">0</strong>
      <span>KM between cities*</span>
    </div>
  </div>

  <div id="journey-map"></div>

  <p class="map-caption">
    *Straight-line distance between consecutive destinations,
    not actual transport distance.
  </p>
</div>
    </section>

    <section class="chapter">
      <p class="eyebrow">CHAPTER 02</p>
      <h2>Money.</h2>
      <p>
        Money spent
      </p>
    </section>

    <section class="chapter">
      <p class="eyebrow">CHAPTER 03</p>
      <h2>Steps taken.</h2>
      <p>
        six months of movement,
        activity and everyday life.
      </p>
    </section>
  </main>

  <footer>
    A little less work. A lot more curiosity.
  </footer>
`

// Sort destinations chronologically
const orderedPlaces = [...places].sort(
  (a, b) => new Date(a.date) - new Date(b.date)
);

// Initialize the map
const map = new maplibregl.Map({
  container: 'journey-map',
  style: 'https://tiles.openfreemap.org/styles/bright',
  center: [0, 30],
  zoom: 2
});

map.on('load', () => {
  console.log('MAP LOADED SUCCESSFULLY');
});

map.on('error', (event) => {
  console.error('MAP ERROR:', event.error);
});

// Add zoom and rotation controls
map.addControl(
  new maplibregl.NavigationControl(),
  'top-right'
);

// Calculate straight-line distance between two coordinates
function calculateDistance(a, b) {
  const R = 6371;

  const toRadians = degrees => degrees * Math.PI / 180;

  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);

  const dLat = toRadians(b[1] - a[1]);
  const dLon = toRadians(b[0] - a[0]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
    Math.cos(lat2) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

// Calculate total distance between destinations
let totalDistance = 0;

for (let i = 1; i < orderedPlaces.length; i++) {
  totalDistance += calculateDistance(
    orderedPlaces[i - 1].coordinates,
    orderedPlaces[i].coordinates
  );
}

// Calculate statistics
const uniqueCities = new Set(
  orderedPlaces.map(place => `${place.city}, ${place.country}`)
);

const uniqueCountries = new Set(
  orderedPlaces.map(place => place.country)
);

document.getElementById('city-count').textContent =
  uniqueCities.size;

document.getElementById('country-count').textContent =
  uniqueCountries.size;

document.getElementById('distance').textContent =
  Math.round(totalDistance).toLocaleString();

// Add markers and draw the journey
map.on('load', () => {

  // Add a marker for every destination
  orderedPlaces.forEach(place => {

    // Build popup safely using DOM elements
    const content = document.createElement('div');

    const heading = document.createElement('h3');
    heading.textContent = `${place.city}, ${place.country}`;

    const date = document.createElement('p');
    date.textContent = new Date(
      `${place.date}T12:00:00`
    ).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const note = document.createElement('p');
    note.textContent = place.note;

    content.append(heading, date, note);

    const popup = new maplibregl.Popup({
      offset: 25
    }).setDOMContent(content);

    new maplibregl.Marker({
      color: '#218675'
    })
      .setLngLat(place.coordinates)
      .setPopup(popup)
      .addTo(map);

  });

  // Connect destinations with a route
  if (orderedPlaces.length > 1) {

    map.addSource('journey', {
      type: 'geojson',

      data: {
        type: 'Feature',
        properties: {},

        geometry: {
          type: 'LineString',

          coordinates: orderedPlaces.map(
            place => place.coordinates
          )
        }
      }
    });

    map.addLayer({
      id: 'journey-line',
      type: 'line',
      source: 'journey',

      paint: {
        'line-color': '#218675',
        'line-width': 2.5,
        'line-dasharray': [2, 2]
      }
    });

  }

  // Automatically zoom to show all destinations
  if (orderedPlaces.length > 0) {

    const bounds = new maplibregl.LngLatBounds();

    orderedPlaces.forEach(place => {
      bounds.extend(place.coordinates);
    });

    map.fitBounds(bounds, {
      padding: 70,
      maxZoom: 5,
      duration: 1000
    });

  }

});

