(() => {
  'use strict';

  const loadingScreen = document.querySelector('#loading-screen');
  const loadingStarLayer = document.querySelector('.loading-star-layer');
  window.setTimeout(() => loadingScreen?.classList.add('is-done'), 1000);

  if (loadingStarLayer) {
    Array.from({ length: 70 }, () => {
      const star = document.createElement('span');
      star.className = 'loading-star';
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.setProperty('--loading-star-size', `${2 + Math.random() * 5}px`);
      star.style.setProperty('--loading-star-delay', `${Math.random() * -2.4}s`);
      loadingStarLayer.appendChild(star);
    });
  }

  const slideIds = ['slide1', 'slide2', 'slideMap', 'slideThank'];
  const slides = [...document.querySelectorAll('.slide')];
  const appShell = document.querySelector('.app-shell');
  const twinkleLayers = [...document.querySelectorAll('.twinkle-layer')];
  let activeIndex = 0;
  let map;
  let userMarker;
  let userAccuracyCircle;
  let userCoords;
  let leafletLoading = false;
  let activeRoute = 'vehicular';
  let routeLayers;

  const routeStart = [-0.195722, -78.505750];
  const routeGate = [-0.197436, -78.506124];
  const routeEnd = [-0.197816, -78.503885];
  const interiorRoute = [routeGate, [-0.198041, -78.506074], [-0.197410, -78.504913], [-0.197327, -78.504612], [-0.197481, -78.503851], routeEnd];
  const pedestrianRoute = [
    [-0.196801, -78.501975],
    [-0.198009, -78.502336],
    [-0.197724, -78.502762],
    [-0.197500, -78.503757],
    [-0.197823, -78.503852]
  ];
  const spacePositions = [
    ['0%', '0%'],
    ['-18%', '7%'],
    ['-36%', '-10%'],
    ['-56%', '8%']
  ];

  function moveThroughSpace(index) {
    const [x, y] = spacePositions[index] || spacePositions[0];
    appShell?.style.setProperty('--space-x', x);
    appShell?.style.setProperty('--space-y', y);
  }

  moveThroughSpace(activeIndex);

  function createTwinkles(layer, count, indexOffset = 0) {
    if (!layer) return [];
    const stars = Array.from({ length: count }, (_, index) => {
      const star = document.createElement('span');
      star.className = 'twinkle-star';
      const horizontalPosition = Math.random() * 100;
      star.style.left = `${horizontalPosition}%`;
      star.style.top = `${4 + Math.random() * 92}%`;
      const isNear = layer.classList.contains('twinkle-layer-near');
      star.style.setProperty('--star-size', `${isNear ? 1.4 + Math.random() * 3.4 : .7 + Math.random() * 1.9}px`);
      star.style.setProperty('--star-opacity', `${isNear ? .55 + Math.random() * .45 : .3 + Math.random() * .45}`);
      star.style.setProperty('--star-delay', `${Math.random() * 8}s`);
      star.style.setProperty('--twinkle-duration', `${1.2 + Math.random() * 1.4}s`);
      if (Math.random() < .1) star.classList.add('twinkle-star-violet');
      star.dataset.index = String(index + indexOffset);
      layer.appendChild(star);
      return star;
    });
    return stars;
  }

  const twinkleStars = [
    ...createTwinkles(twinkleLayers[0], 560),
    ...createTwinkles(twinkleLayers[1], 480, 560),
    ...createTwinkles(twinkleLayers[2], 420, 1040)
  ];
  let lastTwinkleStar;
  function twinkleRandomStar() {
    if (!twinkleStars.length) return;
    let star;
    do {
      star = twinkleStars[Math.floor(Math.random() * twinkleStars.length)];
    } while (twinkleStars.length > 1 && star === lastTwinkleStar);
    lastTwinkleStar = star;
    star.classList.remove('is-twinkling');
    void star.offsetWidth;
    star.classList.add('is-twinkling');
    const nextTwinkle = Math.random() < .16
      ? 1800 + Math.random() * 1800
      : 180 + Math.random() * 850;
    window.setTimeout(twinkleRandomStar, nextTwinkle);
  }
  window.setTimeout(twinkleRandomStar, 350 + Math.random() * 850);

  function showSlide(index) {
    if (index < 0 || index >= slides.length || index === activeIndex) return;
    activeIndex = index;
    moveThroughSpace(activeIndex);
    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeIndex;
      slide.classList.toggle('active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
    });
    if (slideIds[index] === 'slideMap') {
      initializeMap();
      window.setTimeout(() => map?.invalidateSize(), 550);
    }
  }

  function initializeMap() {
    if (map) return true;
    if (!window.L) {
      const status = document.querySelector('.map-status');
      if (status) status.textContent = 'Cargando mapa…';
      if (!leafletLoading) {
        leafletLoading = true;
        const fallback = document.createElement('script');
        fallback.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        fallback.onload = () => {
          leafletLoading = false;
          initializeMap();
        };
        fallback.onerror = () => {
          leafletLoading = false;
          if (status) status.textContent = 'No se pudo cargar el mapa. Revisa tu conexión.';
        };
        document.head.appendChild(fallback);
      }
      return false;
    }
    document.querySelector('.map-status')?.remove();
    map = L.map('map', { zoomControl: false, attributionControl: true });
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    const startIcon = L.divIcon({ className: 'route-start-pin', iconSize: [18, 18], iconAnchor: [9, 9] });
    const endIcon = L.divIcon({ className: 'dest-pin-red', iconSize: [18, 18], iconAnchor: [9, 9] });
    routeLayers = {
      vehicular: L.layerGroup([
        L.polyline([routeStart, routeGate], { color: '#2b4d78', weight: 5, opacity: .95, dashArray: '10 10', lineCap: 'round' }),
        L.polyline(interiorRoute, { color: '#72839a', weight: 5, opacity: .9, dashArray: '7 9', lineCap: 'round' }),
        L.marker(routeStart, { icon: startIcon }).bindTooltip('Referencia inicial', { permanent: true, direction: 'top', className: 'label-marker' }),
        L.marker(routeEnd, { icon: endIcon }).bindTooltip('Evento', { permanent: true, direction: 'top', className: 'label-marker-red' })
      ]),
      peatonal: L.layerGroup([
        L.polyline(pedestrianRoute, { color: '#2b4d78', weight: 5, opacity: .95, dashArray: '10 10', lineCap: 'round' }),
        L.marker(pedestrianRoute.at(-1), { icon: endIcon }).bindTooltip('Evento', { permanent: true, direction: 'top', className: 'label-marker-red' }),
        L.marker(pedestrianRoute[0], { icon: startIcon }).bindTooltip('Inicio peatonal', { permanent: true, direction: 'top', className: 'label-marker' })
      ])
    };
    setRoute('vehicular');
    map.on('locationfound', (event) => {
      userCoords = event.latlng;
      const userIcon = L.divIcon({ className: 'user-pos-marker', iconSize: [16, 16], iconAnchor: [8, 8] });
      if (!userMarker) {
        userMarker = L.marker(event.latlng, { icon: userIcon }).addTo(map);
        userAccuracyCircle = L.circle(event.latlng, { radius: event.accuracy / 2, color: '#315d92', fillColor: '#aebed2', fillOpacity: .2, weight: 1 }).addTo(map);
      } else {
        userMarker.setLatLng(event.latlng);
        userAccuracyCircle.setLatLng(event.latlng).setRadius(event.accuracy / 2);
      }
    });
    map.on('locationerror', () => { userCoords = null; });
    map.locate({ watch: true, enableHighAccuracy: true });
    return true;
  }

  function setRoute(routeType) {
    if (!map || !routeLayers?.[routeType]) return;
    Object.values(routeLayers).forEach((layer) => map.removeLayer(layer));
    routeLayers[routeType].addTo(map);
    activeRoute = routeType;
    const coordinates = routeType === 'peatonal' ? pedestrianRoute : [routeStart, routeGate, ...interiorRoute];
    map.fitBounds(L.latLngBounds(coordinates), { padding: [28, 28] });
    const mapLink = document.querySelector('#map-link');
    const destination = routeType === 'peatonal' ? pedestrianRoute.at(-1) : routeGate;
    if (mapLink) mapLink.href = `https://www.google.com/maps/dir/?api=1&destination=${destination[0]},${destination[1]}`;
    document.querySelectorAll('.route-tab').forEach((tab) => {
      const isActive = tab.dataset.route === activeRoute;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });
  }

  document.querySelectorAll('.route-tab').forEach((tab) => {
    tab.addEventListener('click', () => setRoute(tab.dataset.route));
  });

  document.querySelector('#btn-recenter').addEventListener('click', () => {
    if (!map) return;
    if (userCoords) map.setView(userCoords, 18, { animate: true });
    else map.locate({ setView: true, maxZoom: 18, enableHighAccuracy: true });
  });

  let touchStartY = 0;
  document.addEventListener('touchstart', (event) => {
    if (event.target.closest('#map, a, button')) return;
    touchStartY = event.changedTouches[0].screenY;
  }, { passive: true });
  document.addEventListener('touchend', (event) => {
    if (event.target.closest('#map, a, button')) return;
    const distance = touchStartY - event.changedTouches[0].screenY;
    if (Math.abs(distance) < 48) return;
    if (distance > 0) showSlide(activeIndex + 1);
    else showSlide(activeIndex - 1);
  }, { passive: true });

  let wheelLocked = false;
  document.addEventListener('wheel', (event) => {
    if (wheelLocked || Math.abs(event.deltaY) < 20) return;
    wheelLocked = true;
    showSlide(activeIndex + (event.deltaY > 0 ? 1 : -1));
    window.setTimeout(() => { wheelLocked = false; }, 700);
  }, { passive: true });

  window.setTimeout(() => {
    if (activeIndex === 2) initializeMap();
  }, 0);
})();
