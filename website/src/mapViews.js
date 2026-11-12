const modes = ['driving', 'flying', 'train']
const modeStyles = [
  { mode: 'driving', color: '#218675', dashArray: null },
  { mode: 'flying', color: '#c05a43', dashArray: [2, 2] },
  { mode: 'train', color: '#416f9a', dashArray: [1, 1] },
  { mode: 'unknown', color: '#8a8a82', dashArray: [2, 2] }
]
const otherParkKinds = new Set([
  'state-park',
  'national-monument',
  'foreign-national-park',
  'foreign-provincial-park'
])
const usStatesGeoJsonUrl = 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json'
const canadaProvincesGeoJsonUrl = 'https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/canada.geojson'
const countriesGeoJsonUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'

const formatDate = date => new Date(`${date}T12:00:00`).toLocaleDateString(
  'en-US',
  { day: 'numeric', month: 'long', year: 'numeric' }
)

const routeFeatures = stops => stops.slice(1).map((destination, index) => ({
  type: 'Feature',
  properties: {
    mode: modes.includes(destination.transportFromPrevious)
      ? destination.transportFromPrevious
      : 'unknown'
  },
  geometry: {
    type: 'LineString',
    coordinates: [stops[index].coordinates, destination.coordinates]
  }
}))

const addRoutes = (map, stops, { opacity = 1, width = 3 } = {}) => {
  map.addSource('routes', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: routeFeatures(stops) }
  })

  map.addLayer({
    id: 'route-casing',
    type: 'line',
    source: 'routes',
    paint: {
      'line-color': '#f7f5ef',
      'line-width': width + 2,
      'line-opacity': Math.min(opacity + 0.1, 1)
    }
  })

  modeStyles.forEach(({ mode, color, dashArray }) => {
    const paint = {
      'line-color': color,
      'line-width': width,
      'line-opacity': opacity
    }
    if (dashArray) paint['line-dasharray'] = dashArray
    map.addLayer({
      id: `route-${mode}`,
      type: 'line',
      source: 'routes',
      filter: ['==', ['get', 'mode'], mode],
      paint
    })
  })
}

const createPopup = (maplibregl, visits, coordinates) => {
  const content = document.createElement('div')
  const heading = document.createElement('h3')
  heading.textContent = `${visits[0].city}, ${visits[0].country}`
  content.append(heading)

  visits.forEach(visit => {
    const date = document.createElement('p')
    date.textContent = formatDate(visit.date)
    const note = document.createElement('p')
    note.textContent = visit.note
    content.append(date, note)
  })

  return new maplibregl.Popup({ offset: 18 })
    .setDOMContent(content)
    .setLngLat(coordinates)
}

const showClusterCarousel = async (maplibregl, map, cluster) => {
  const { cluster_id: clusterId, point_count: pointCount } = cluster.properties
  const leaves = await map.getSource('all-stops').getClusterLeaves(clusterId, pointCount, 0)
  if (!leaves?.length) return

  const visits = leaves
    .map(leaf => ({ ...leaf.properties, coordinates: leaf.geometry.coordinates }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const content = document.createElement('div')
  content.className = 'scratch-cluster-carousel'
  const heading = document.createElement('h3')
  const counter = document.createElement('span')
  const date = document.createElement('p')
  const note = document.createElement('p')
  const controls = document.createElement('div')
  controls.className = 'scratch-cluster-controls'
  const previous = document.createElement('button')
  previous.type = 'button'
  previous.textContent = '←'
  previous.setAttribute('aria-label', 'Previous stop in this cluster')
  const next = document.createElement('button')
  next.type = 'button'
  next.textContent = '→'
  next.setAttribute('aria-label', 'Next stop in this cluster')
  let index = 0

  const update = () => {
    const visit = visits[index]
    heading.textContent = `${visit.city}, ${visit.country}`
    counter.textContent = `${index + 1} of ${visits.length}`
    date.textContent = formatDate(visit.date)
    note.textContent = visit.note
    previous.disabled = index === 0
    next.disabled = index === visits.length - 1
  }

  previous.addEventListener('click', () => {
    index = Math.max(0, index - 1)
    update()
  })
  next.addEventListener('click', () => {
    index = Math.min(visits.length - 1, index + 1)
    update()
  })
  controls.append(previous, counter, next)
  content.append(heading, date, note, controls)
  update()

  new maplibregl.Popup({ offset: 18, maxWidth: '260px' })
    .setDOMContent(content)
    .setLngLat(cluster.geometry.coordinates)
    .addTo(map)
}

const getParkColor = kind => kind === 'national-park'
  ? '#c05a43'
  : otherParkKinds.has(kind)
    ? '#416f9a'
    : '#218675'

const fitStops = (maplibregl, map, stops, padding, maxZoom) => {
  const bounds = new maplibregl.LngLatBounds()
  stops.forEach(stop => bounds.extend(stop.coordinates))
  map.fitBounds(bounds, { padding, maxZoom, duration: 0 })
  map.resize()
  map.triggerRepaint()
}

export const renderOverviewMap = (maplibregl, places) => {
  const map = new maplibregl.Map({
    container: 'overview-map',
    style: 'https://tiles.openfreemap.org/styles/bright',
    center: [-40, 35],
    zoom: 2
  })
  map.addControl(new maplibregl.NavigationControl(), 'top-right')

  map.on('style.load', () => {
    const visitedStates = [...new Set(places.map(place => place.state).filter(Boolean))]
    const visitedStateColors = visitedStates.flatMap(state => [state, '#829f8f'])
    const visitedProvinces = [...new Set(places.map(place => place.province).filter(Boolean))]
    const visitedProvinceColors = visitedProvinces.flatMap(province => [province === 'Québec' ? 'Quebec' : province, '#829f8f'])

    map.addSource('us-states', { type: 'geojson', data: usStatesGeoJsonUrl })
    map.addLayer({
      id: 'us-state-fill',
      type: 'fill',
      source: 'us-states',
      paint: {
        'fill-color': ['match', ['get', 'name'], ...visitedStateColors, 'rgba(0, 0, 0, 0)'],
        'fill-opacity': 0.92,
        'fill-outline-color': '#f7f5ef'
      }
    })

    map.addSource('canada-provinces', { type: 'geojson', data: canadaProvincesGeoJsonUrl })
    map.addLayer({
      id: 'canada-province-fill',
      type: 'fill',
      source: 'canada-provinces',
      filter: ['in', ['get', 'name'], ['literal', visitedProvinceColors.filter((_, index) => index % 2 === 0)]],
      paint: {
        'fill-color': '#829f8f',
        'fill-opacity': 0.92,
        'fill-outline-color': '#f7f5ef'
      }
    })

    map.addSource('visited-countries', { type: 'geojson', data: countriesGeoJsonUrl })
    map.addLayer({
      id: 'visited-country-fill',
      type: 'fill',
      source: 'visited-countries',
      filter: ['in', ['get', 'name'], ['literal', ['Brazil', 'Turkey']]],
      paint: {
        'fill-color': '#829f8f',
        'fill-opacity': 0.92,
        'fill-outline-color': '#f7f5ef'
      }
    })

    const features = places.map(place => ({
      type: 'Feature',
      properties: {
        city: place.city,
        country: place.country,
        date: place.date,
        note: place.note,
        kind: place.kind ?? 'destination'
      },
      geometry: { type: 'Point', coordinates: place.coordinates }
    }))

    map.addSource('all-stops', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
      cluster: true,
      clusterRadius: 42,
      clusterMaxZoom: 5
    })

    const parkFeatures = [...new Map(
      places
        .filter(place => place.kind)
        .map(place => [`${place.kind}:${place.city}`, {
          type: 'Feature',
          properties: {
            city: place.city,
            country: place.country,
            date: place.date,
            note: place.note,
            kind: place.kind
          },
          geometry: { type: 'Point', coordinates: place.coordinates }
        }])
    ).values()]

    map.addSource('parks', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: parkFeatures }
    })

    map.addLayer({
      id: 'stop-clusters',
      type: 'circle',
      source: 'all-stops',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#218675',
        'circle-radius': ['step', ['get', 'point_count'], 13, 6, 17, 20, 22],
        'circle-stroke-color': '#f7f5ef',
        'circle-stroke-width': 2
      }
    })

    map.addLayer({
      id: 'stop-cluster-count',
      type: 'symbol',
      source: 'all-stops',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 11
      },
      paint: { 'text-color': '#ffffff' }
    })

    map.addLayer({
      id: 'stop-points',
      type: 'circle',
      source: 'all-stops',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#218675',
        'circle-radius': 5,
        'circle-stroke-color': '#f7f5ef',
        'circle-stroke-width': 1.5
      }
    })

    map.addLayer({
      id: 'park-points',
      type: 'circle',
      source: 'parks',
      paint: {
        'circle-color': [
          'match', ['get', 'kind'],
          'national-park', '#c05a43',
          '#416f9a'
        ],
        'circle-radius': 7,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5
      }
    })

    map.on('click', 'stop-clusters', event => {
      const cluster = event.features?.[0]
      if (!cluster) return
      showClusterCarousel(maplibregl, map, cluster)
    })

    map.on('click', 'stop-points', event => {
      const feature = event.features?.[0]
      if (!feature) return
      const place = feature.properties
      const popupContent = document.createElement('div')
      const heading = document.createElement('h3')
      heading.textContent = `${place.city}, ${place.country}`
      const date = document.createElement('p')
      date.textContent = formatDate(place.date)
      const note = document.createElement('p')
      note.textContent = place.note
      popupContent.append(heading, date, note)
      new maplibregl.Popup({ offset: 16 })
        .setDOMContent(popupContent)
        .setLngLat(feature.geometry.coordinates)
        .addTo(map)
    })

    map.on('click', 'park-points', event => {
      const feature = event.features?.[0]
      if (!feature) return
      const parkVisits = places.filter(place =>
        place.city === feature.properties.city &&
        place.country === feature.properties.country &&
        place.kind
      )
      createPopup(maplibregl, parkVisits, feature.geometry.coordinates).addTo(map)
    })

    ;['stop-clusters', 'stop-points', 'park-points'].forEach(layerId => {
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
    })

    const overviewBounds = new maplibregl.LngLatBounds([-130, -30], [36, 54])
    map.fitBounds(overviewBounds, {
      padding: { top: 48, right: 48, bottom: 48, left: 48 },
      maxZoom: 1.5,
      duration: 0
    })
    map.resize()
    map.triggerRepaint()
  })
}

const createTripMap = (maplibregl, trip) => {
  const map = new maplibregl.Map({
    container: `trip-map-${trip.id}`,
    style: 'https://tiles.openfreemap.org/styles/bright',
    center: trip.stops[0].coordinates,
    zoom: 3
  })
  map.addControl(new maplibregl.NavigationControl(), 'top-right')

  const entry = document.getElementById(`trip-map-${trip.id}`).closest('.trip-map-entry')
  const player = entry.querySelector('[data-trip-player]')
  const count = player.querySelector('[data-trip-count]')
  const progress = player.querySelector('[data-trip-progress]')
  const meta = player.querySelector('[data-trip-meta]')
  const placeTitle = player.querySelector('[data-trip-place]')
  const note = player.querySelector('[data-trip-note]')
  const modeLabel = player.querySelector('[data-trip-mode]')
  const startButton = player.querySelector('[data-trip-start]')
  const controls = player.querySelector('[data-trip-controls]')
  const previousButton = player.querySelector('[data-trip-previous]')
  const nextButton = player.querySelector('[data-trip-next]')
  const restartButton = player.querySelector('[data-trip-restart]')
  const routes = routeFeatures(trip.stops)
  const markersByCity = new Map()
  const modesByType = { driving: 'Driving', flying: 'Flying', train: 'Train' }
  let activeIndex = -1
  let mapReady = false
  let activeVehicle = null
  let animationFrame = null

  const clearVehicle = () => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame)
    animationFrame = null
    activeVehicle?.remove()
    activeVehicle = null
  }

  const fitFullTrip = () => {
    const padding = window.matchMedia('(max-width: 600px)').matches
      ? { top: player.offsetHeight + 20, right: 20, bottom: 20, left: 20 }
      : { top: 24, right: 24, bottom: 24, left: player.offsetWidth + 40 }
    fitStops(maplibregl, map, trip.stops, padding, 8)
  }

  const focusStop = index => {
    if (!mapReady) return
    if (index === trip.stops.length - 1) {
      fitFullTrip()
      return
    }

    const stop = trip.stops[index]
    const isMobile = window.matchMedia('(max-width: 600px)').matches
    const offset = isMobile ? [0, player.offsetHeight / 2] : [player.offsetWidth / 2, 0]
    const zoomByMode = { driving: 8.25, flying: 5.25, train: 7.75, unknown: 6.5 }
    map.flyTo({
      center: stop.coordinates,
      offset,
      zoom: index === 0 ? 8 : zoomByMode[stop.transportFromPrevious] ?? 6.5,
      duration: 850
    })
  }

  const animateVehicle = (from, to, mode) => {
    clearVehicle()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const icons = { driving: '🚗', flying: '✈️', train: '🚆' }
    const element = document.createElement('div')
    element.className = `travel-token travel-token--${mode}`
    element.setAttribute('aria-hidden', 'true')
    element.textContent = icons[mode] ?? '•'
    activeVehicle = new maplibregl.Marker({ element, anchor: 'center' })
      .setLngLat(from)
      .addTo(map)

    const duration = { driving: 950, flying: 1500, train: 1250 }[mode] ?? 1000
    let startedAt = null
    const animateFrame = timestamp => {
      startedAt ??= timestamp
      const progressValue = Math.min((timestamp - startedAt) / duration, 1)
      const eased = progressValue * progressValue * (3 - 2 * progressValue)
      const startPoint = map.project(from)
      const endPoint = map.project(to)
      const point = [
        startPoint.x + (endPoint.x - startPoint.x) * eased,
        startPoint.y + (endPoint.y - startPoint.y) * eased
      ]
      activeVehicle?.setLngLat(map.unproject(point))
      if (progressValue < 1) animationFrame = requestAnimationFrame(animateFrame)
      else clearVehicle()
    }
    animationFrame = requestAnimationFrame(animateFrame)
  }

  const showStop = (index, shouldAnimate = false) => {
    if (!mapReady) return
    const previousIndex = activeIndex
    activeIndex = Math.max(0, Math.min(index, trip.stops.length - 1))
    const stop = trip.stops[activeIndex]
    const previousStop = trip.stops[activeIndex - 1]
    const isComplete = activeIndex === trip.stops.length - 1

    count.textContent = `${activeIndex + 1} of ${trip.stops.length} stops`
    progress.style.width = `${((activeIndex + 1) / trip.stops.length) * 100}%`
    meta.textContent = isComplete
      ? `TRIP COMPLETE · ${formatDate(stop.date)}`
      : activeIndex === 0
        ? `STARTING POINT · ${formatDate(stop.date)}`
        : `STOP ${activeIndex + 1} · ${formatDate(stop.date)}`
    placeTitle.textContent = `${stop.city}, ${stop.country}`
    note.textContent = stop.note
    modeLabel.textContent = isComplete
      ? 'Full trip map · all routes shown'
      : previousStop
        ? `${modesByType[stop.transportFromPrevious] ?? 'Mode not recorded'} from ${previousStop.city}`
        : 'Trip departure'

    startButton.hidden = true
    controls.hidden = false
    previousButton.disabled = activeIndex === 0
    nextButton.hidden = isComplete
    restartButton.hidden = !isComplete

    const source = map.getSource('routes')
    const activeRoutes = isComplete
      ? routes
      : activeIndex > 0
        ? [routes[activeIndex - 1]]
        : []
    source.setData({ type: 'FeatureCollection', features: activeRoutes })

    markersByCity.forEach((marker, city) => {
      marker.getElement().classList.toggle('is-current', city === `${stop.city}, ${stop.country}`)
    })
    focusStop(activeIndex)

    if (shouldAnimate && activeIndex === previousIndex + 1 && previousStop) {
      animateVehicle(previousStop.coordinates, stop.coordinates, stop.transportFromPrevious)
    } else {
      clearVehicle()
    }
  }

  startButton.addEventListener('click', () => showStop(0))
  previousButton.addEventListener('click', () => showStop(activeIndex - 1))
  nextButton.addEventListener('click', () => showStop(activeIndex + 1, true))
  restartButton.addEventListener('click', () => showStop(0))
  player.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' && activeIndex > 0) showStop(activeIndex - 1)
    if (event.key === 'ArrowRight' && activeIndex < trip.stops.length - 1) showStop(activeIndex + 1, true)
  })

  let touchStart = null
  player.addEventListener('touchstart', event => {
    const touch = event.changedTouches[0]
    touchStart = { x: touch.clientX, y: touch.clientY }
  }, { passive: true })
  player.addEventListener('touchend', event => {
    if (!touchStart || activeIndex < 0) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - touchStart.x
    const deltaY = touch.clientY - touchStart.y
    touchStart = null
    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY)) return
    const direction = deltaX < 0 ? 1 : -1
    showStop(activeIndex + direction, direction > 0)
  }, { passive: true })

  map.on('style.load', () => {
    addRoutes(map, trip.stops)

    const visitsByCity = new Map()
    trip.stops.forEach(stop => {
      const key = `${stop.city}, ${stop.country}`
      const visits = visitsByCity.get(key) ?? []
      visits.push(stop)
      visitsByCity.set(key, visits)
    })

    visitsByCity.forEach((visits, city) => {
      const parkVisit = visits.find(visit => visit.kind)
      const marker = new maplibregl.Marker({ color: getParkColor(parkVisit?.kind) })
        .setLngLat(visits[0].coordinates)
        .addTo(map)
      marker.setPopup(createPopup(maplibregl, visits, visits[0].coordinates))
      const markerElement = marker.getElement()
      markerElement.classList.add('trip-map-marker')
      markerElement.setAttribute('aria-label', `Jump to ${visits[0].city} in ${trip.title}`)
      markerElement.addEventListener('click', () => {
        showStop(trip.stops.findIndex(stop => `${stop.city}, ${stop.country}` === city))
      })
      markersByCity.set(city, marker)
    })

    mapReady = true
    fitFullTrip()
  })
}

export const renderTripMaps = (maplibregl, tripPlans) => {
  const entries = [...document.querySelectorAll('.trip-map-entry')]
  if (!('IntersectionObserver' in window)) {
    tripPlans.forEach(trip => createTripMap(maplibregl, trip))
    return
  }

  const observer = new IntersectionObserver(intersections => {
    intersections.forEach(intersection => {
      if (!intersection.isIntersecting) return
      const tripIndex = Number(intersection.target.dataset.tripIndex)
      createTripMap(maplibregl, tripPlans[tripIndex])
      observer.unobserve(intersection.target)
    })
  }, { rootMargin: '400px 0px' })

  entries.forEach(entry => observer.observe(entry))
}