/**
 * SHOBHA EDUCATION TRUST — INTERACTIVE GEOLOCATION MAP CONTROLLER
 * Leaflet & OpenStreetMap implementation for Sarveshwaree Mahavidyalaya Campus
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Verified Destination Coordinates & Address
// Plus Code: CPW3+HHW (7MQ4CPW3+HH), Noorpur / Kamruddinpur, Rampur, Jaunpur, UP 222203
export const CAMPUS_COORDS = {
  lat: 25.4464,
  lng: 82.7039,
  zoom: 15
};

export const CAMPUS_DETAILS = {
  name: 'Sarveshwaree Mahavidyalaya',
  parent: 'Shobha Education Trust',
  address: 'Kamruddinpur, Noorpur, Rampur, Jaunpur, Uttar Pradesh – 222203, India',
  hours: '10:00 AM – 3:00 PM (Monday – Saturday)',
  phonePrimary: '8318784268',
  phoneAlt: '8765926859',
  email: 'sanjayjourno2009@gmail.com',
  encodedDestination: encodeURIComponent('Sarveshwaree Mahavidyalaya, Kamruddinpur, Noorpur, Rampur, Jaunpur, Uttar Pradesh 222203')
};

// Calculate Geodesic Haversine Distance (km)
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's mean radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d < 10 ? d.toFixed(1) : Math.round(d).toString();
}

/**
 * Initialize Interactive Campus Map
 */
export function initCampusMap() {
  const mapElement = document.getElementById('campusMap');
  if (!mapElement) return;

  const getDirectionsBtn = document.getElementById('btnGetDirections');
  const useLocationBtn = document.getElementById('btnUseMyLocation');
  const geoStatusPanel = document.getElementById('geoStatusPanel');
  const geoStatusText = document.getElementById('geoStatusText');
  const geoStatusIcon = document.getElementById('geoStatusIcon');
  const clearLocationBtn = document.getElementById('btnClearLocation');

  // Set default Google Maps destination link
  const defaultDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${CAMPUS_DETAILS.encodedDestination}`;
  if (getDirectionsBtn) {
    getDirectionsBtn.href = defaultDirectionsUrl;
  }

  // Create Custom Institutional Marker Pin (Navy with Gold Trim)
  const campusIconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="36" height="48">
      <defs>
        <filter id="pinShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#0a1742" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path d="M18 1 C8.6 1 1 8.6 1 18 C1 29 18 47 18 47 C18 47 35 29 35 18 C35 8.6 27.4 1 18 1 Z" 
            fill="#12296B" stroke="#F2C500" stroke-width="2.5" filter="url(#pinShadow)"/>
      <circle cx="18" cy="18" r="8" fill="#F2C500"/>
      <path d="M14 17 L18 14 L22 17 L18 20 Z" fill="#12296B"/>
      <circle cx="18" cy="19" r="1.5" fill="#12296B"/>
    </svg>
  `;

  const campusIcon = L.divIcon({
    className: 'custom-campus-pin',
    html: campusIconSvg,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -46]
  });

  // User Geolocation Pin (Vibrant Cyan/Blue Ring)
  const userIconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
      <circle cx="14" cy="14" r="12" fill="#0284C7" fill-opacity="0.25"/>
      <circle cx="14" cy="14" r="7" fill="#0284C7" stroke="#ffffff" stroke-width="2.5"/>
    </svg>
  `;

  const userIcon = L.divIcon({
    className: 'custom-user-pin',
    html: userIconSvg,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });

  // Initialize Leaflet Map Instance
  const map = L.map(mapElement, {
    center: [CAMPUS_COORDS.lat, CAMPUS_COORDS.lng],
    zoom: CAMPUS_COORDS.zoom,
    scrollWheelZoom: false, // Prevents intercepting page scroll on touch / trackpads
    zoomControl: true,
    attributionControl: true
  });

  // Add OpenStreetMap Tile Layer
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Campus Marker & Rich Institutional Popup
  const popupHtml = `
    <div class="campus-map-popup">
      <div class="popup-crest-badge">SHOBHA EDUCATION TRUST</div>
      <h3 class="popup-title">${CAMPUS_DETAILS.name}</h3>
      <p class="popup-address">${CAMPUS_DETAILS.address}</p>
      <div class="popup-meta">
        <span>⏰ ${CAMPUS_DETAILS.hours}</span>
        <span>📞 ${CAMPUS_DETAILS.phonePrimary} • ${CAMPUS_DETAILS.phoneAlt}</span>
      </div>
      <a href="${defaultDirectionsUrl}" target="_blank" rel="noopener noreferrer" class="popup-directions-btn">
        OPEN GOOGLE MAPS DIRECTIONS ↗
      </a>
    </div>
  `;

  const campusMarker = L.marker([CAMPUS_COORDS.lat, CAMPUS_COORDS.lng], {
    icon: campusIcon,
    title: CAMPUS_DETAILS.name,
    alt: `${CAMPUS_DETAILS.name} Campus Marker`
  }).addTo(map);

  campusMarker.bindPopup(popupHtml, {
    maxWidth: 320,
    className: 'institutional-popup'
  });

  // Open popup on initial desktop view
  if (window.innerWidth > 768) {
    campusMarker.openPopup();
  }

  // Ensure map container renders properly across all layout recalculations
  const refreshMapSize = () => {
    map.invalidateSize();
  };

  setTimeout(refreshMapSize, 150);
  setTimeout(refreshMapSize, 600);
  window.addEventListener('resize', refreshMapSize);

  // Re-invalidate size when section scrolls into viewport
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          refreshMapSize();
        }
      });
    }, { threshold: 0.1 });
    observer.observe(mapElement);
  }

  // Geolocation Layer References
  let userMarker = null;
  let userAccuracyCircle = null;
  let routePolyline = null;

  // Helper to show status message
  const setStatus = (message, type = 'info', showReset = false) => {
    if (!geoStatusPanel || !geoStatusText) return;
    geoStatusPanel.style.display = 'flex';
    geoStatusPanel.className = `geo-status-banner geo-status-${type}`;
    geoStatusText.textContent = message;

    if (geoStatusIcon) {
      if (type === 'success') geoStatusIcon.textContent = '✓';
      else if (type === 'error') geoStatusIcon.textContent = '⚠️';
      else if (type === 'loading') geoStatusIcon.textContent = '⏳';
      else geoStatusIcon.textContent = 'ℹ️';
    }

    if (clearLocationBtn) {
      clearLocationBtn.style.display = showReset ? 'inline-block' : 'none';
    }
  };

  const clearUserLocation = () => {
    if (userMarker) {
      map.removeLayer(userMarker);
      userMarker = null;
    }
    if (userAccuracyCircle) {
      map.removeLayer(userAccuracyCircle);
      userAccuracyCircle = null;
    }
    if (routePolyline) {
      map.removeLayer(routePolyline);
      routePolyline = null;
    }

    // Reset directions URL to verified campus destination without origin
    if (getDirectionsBtn) {
      getDirectionsBtn.href = defaultDirectionsUrl;
    }

    // Reset button state
    if (useLocationBtn) {
      useLocationBtn.disabled = false;
      useLocationBtn.innerHTML = '<span class="geo-icon">📍</span> USE MY LOCATION';
    }

    if (geoStatusPanel) {
      geoStatusPanel.style.display = 'none';
    }

    // Center back to campus
    map.setView([CAMPUS_COORDS.lat, CAMPUS_COORDS.lng], CAMPUS_COORDS.zoom, { animate: true });
    campusMarker.openPopup();
  };

  if (clearLocationBtn) {
    clearLocationBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearUserLocation();
    });
  }

  // Geolocation Request Handler
  if (useLocationBtn) {
    useLocationBtn.addEventListener('click', (e) => {
      e.preventDefault();

      if (!('geolocation' in navigator)) {
        setStatus('Geolocation is not supported by your web browser. You can still use the "Get Directions" button to navigate.', 'error', false);
        return;
      }

      useLocationBtn.disabled = true;
      useLocationBtn.innerHTML = '<span class="geo-icon geo-spinner">⌛</span> LOCATING...';
      setStatus('Requesting browser location permission...', 'loading', false);

      const geoOptions = {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 0;

          // Calculate approximate straight-line geodesic distance
          const distanceKm = calculateDistanceKm(userLat, userLng, CAMPUS_COORDS.lat, CAMPUS_COORDS.lng);

          // Update Directions Link with user's origin
          const personalizedDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLat.toFixed(6)},${userLng.toFixed(6)}&destination=${CAMPUS_DETAILS.encodedDestination}`;
          if (getDirectionsBtn) {
            getDirectionsBtn.href = personalizedDirectionsUrl;
          }

          // Clean up any previous layers
          if (userMarker) map.removeLayer(userMarker);
          if (userAccuracyCircle) map.removeLayer(userAccuracyCircle);
          if (routePolyline) map.removeLayer(routePolyline);

          // Draw User Marker
          userMarker = L.marker([userLat, userLng], {
            icon: userIcon,
            title: 'Your Approximate Location',
            alt: 'Your Location'
          }).addTo(map);

          userMarker.bindPopup(`
            <div class="user-map-popup">
              <strong>YOUR LOCATION</strong>
              <p>Approx. <strong>${distanceKm} km</strong> straight-line distance to Sarveshwaree Mahavidyalaya.</p>
              <a href="${personalizedDirectionsUrl}" target="_blank" rel="noopener noreferrer" class="popup-directions-btn">
                GET TURN-BY-TURN ROUTE ↗
              </a>
            </div>
          `);

          // Draw Accuracy Circle if accuracy > 20 meters
          if (accuracy > 20) {
            userAccuracyCircle = L.circle([userLat, userLng], {
              radius: Math.min(accuracy, 2000),
              color: '#0284C7',
              fillColor: '#0284C7',
              fillOpacity: 0.12,
              weight: 1.5,
              dashArray: '3, 6'
            }).addTo(map);
          }

          // Connect User and Campus with subtle dashed line
          routePolyline = L.polyline([
            [userLat, userLng],
            [CAMPUS_COORDS.lat, CAMPUS_COORDS.lng]
          ], {
            color: '#12296B',
            weight: 2.5,
            dashArray: '6, 8',
            opacity: 0.75
          }).addTo(map);

          // Adjust Map Viewport to fit both points comfortably
          const bounds = L.latLngBounds([
            [userLat, userLng],
            [CAMPUS_COORDS.lat, CAMPUS_COORDS.lng]
          ]);
          map.fitBounds(bounds, {
            padding: [45, 45],
            maxZoom: 14
          });

          // Update UI States
          useLocationBtn.disabled = false;
          useLocationBtn.innerHTML = '<span class="geo-icon">✓</span> LOCATION ACTIVE';
          setStatus(`Your location is detected. Campus is ~${distanceKm} km away (approx. straight-line distance). Google Maps origin is pre-filled.`, 'success', true);
        },
        (error) => {
          useLocationBtn.disabled = false;
          useLocationBtn.innerHTML = '<span class="geo-icon">📍</span> USE MY LOCATION';

          let errorMsg = '';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = 'Location permission was denied. You can still click "Get Directions" to open Google Maps directly.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = 'Location information is currently unavailable. Please verify your device GPS / network location settings.';
              break;
            case error.TIMEOUT:
              errorMsg = 'The request to obtain your location timed out. Please try again or use the "Get Directions" button.';
              break;
            default:
              errorMsg = 'Unable to determine your location. Please use the "Get Directions" button to find the route.';
              break;
          }

          setStatus(errorMsg, 'error', false);
        },
        geoOptions
      );
    });
  }
}

/**
 * Initialize Compact Decorative Geolocation Strip Map on Homepage
 */
export function initHomeCampusMap() {
  const mapElement = document.getElementById('homeCampusMap');
  if (!mapElement) return;

  const initialCenterLng = typeof window !== 'undefined' && window.innerWidth > 768 
    ? CAMPUS_COORDS.lng - 0.003 
    : CAMPUS_COORDS.lng;

  const map = L.map(mapElement, {
    center: [CAMPUS_COORDS.lat, initialCenterLng],
    zoom: 15,
    scrollWheelZoom: false,
    zoomControl: false,
    attributionControl: false
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  const campusIconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="34" height="44">
      <defs>
        <filter id="homePinShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#0a1742" flood-opacity="0.4"/>
        </filter>
      </defs>
      <path d="M18 1 C8.6 1 1 8.6 1 18 C1 29 18 47 18 47 C18 47 35 29 35 18 C35 8.6 27.4 1 18 1 Z" 
            fill="#12296B" stroke="#F2C500" stroke-width="2.5" filter="url(#homePinShadow)"/>
      <circle cx="18" cy="18" r="8" fill="#F2C500"/>
      <path d="M14 17 L18 14 L22 17 L18 20 Z" fill="#12296B"/>
      <circle cx="18" cy="19" r="1.5" fill="#12296B"/>
    </svg>
  `;

  const campusIcon = L.divIcon({
    className: 'custom-campus-pin',
    html: campusIconSvg,
    iconSize: [34, 44],
    iconAnchor: [17, 44]
  });

  const homeMarker = L.marker([CAMPUS_COORDS.lat, CAMPUS_COORDS.lng], {
    icon: campusIcon,
    title: 'Sarveshwaree Mahavidyalaya Campus'
  }).addTo(map);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${CAMPUS_DETAILS.encodedDestination}`;
  homeMarker.bindPopup(`
    <div style="font-family: var(--font-body); padding: 4px; font-size: 13px; min-width: 200px;">
      <strong style="color: #12296B; font-size: 13.5px; display: block; margin-bottom: 2px;">Sarveshwaree Mahavidyalaya</strong>
      <div style="color: #64748B; font-size: 11.5px; margin-bottom: 8px;">Kamruddinpur, Noorpur, Rampur, Jaunpur</div>
      <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="background: #F2C500; color: #12296B; font-weight: 700; font-size: 11px; padding: 5px 12px; border-radius: 2px; text-decoration: none; display: inline-block;">
        GET DIRECTIONS ↗
      </a>
    </div>
  `, {
    offset: [0, -38]
  });

  const refreshSize = () => map.invalidateSize();
  setTimeout(refreshSize, 200);
  setTimeout(refreshSize, 600);
  window.addEventListener('resize', refreshSize);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          refreshSize();
        }
      });
    }, { threshold: 0.1 });
    observer.observe(mapElement);
  }
}

