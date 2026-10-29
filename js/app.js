/**
 * app.js - application entry point.
 *
 * Single responsibility: bootstrap the app and wire the modules together
 * (store <-> api <-> ui), including the geolocation-first boot sequence.
 */

import { createStore, loadPersisted, persist } from './state.js';
import { fetchForecast, fetchByCoords, fetchIpLocation } from './api.js';
import { getUnitConfig } from './units.js';
import { renderApp, renderStatus } from './ui.js';
import { initSearch } from './search.js';
import { initUnitsDropdown } from './ui.js';

const root = document;

// European countries use 24-hour time by default; most of the rest of the
// world defaults to 12-hour. The list is matched against the country name
// returned by Open-Meteo (English).
const EUROPEAN_COUNTRIES = new Set([
  'Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herzegovina',
  'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland',
  'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy',
  'Kosovo', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Malta',
  'Moldova', 'Monaco', 'Montenegro', 'Netherlands', 'North Macedonia', 'Norway',
  'Poland', 'Portugal', 'Romania', 'Russia', 'San Marino', 'Serbia', 'Slovakia',
  'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Turkey', 'Ukraine',
  'United Kingdom', 'Vatican City',
]);

function detectTimeFormat(country) {
  if (typeof country === 'string' && country.trim() !== '') {
    return EUROPEAN_COUNTRIES.has(country.trim()) ? '24h' : '12h';
  }
  // Fall back to the browser/OS preferred hour cycle when no country is known.
  try {
    const hourCycle = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
      .resolvedOptions().hourCycle;
    return hourCycle === 'h12' ? '12h' : '24h';
  } catch {
    return '24h';
  }
}

function $(selector) {
  return root.querySelector(selector);
}

const store = createStore(loadPersisted());

const currentRoot = $('#current');
const metricsRoot = $('#metrics');
const dailyRoot = $('#daily');
const hourlyRoot = $('#hourly');
const searchRoot = $('.search');
const unitsRoot = $('.units');
const statusRoot = $('#status');
const hourlySelect = $('#hourly-day');
const timeToggle = $('[data-time-toggle]');

let lastFetch = null; // { kind: 'coords'|'location', payload }

let currentFetchController = null;

async function fetchWeather(location, units) {
  // Cancel any in-flight request so a slow earlier fetch cannot overwrite a
  // newer one (race condition when the user searches/switches quickly).
  if (currentFetchController) {
    currentFetchController.abort();
  }
  const controller = new AbortController();
  currentFetchController = controller;
  const { signal } = controller;

  store.setState({ status: 'loading', error: null });
  try {
    const data =
      location && location.lat !== null && location.lat !== undefined
      && location.lon !== null && location.lon !== undefined
      && !location.name
        ? await fetchByCoords(location.lat, location.lon, units, { signal })
        : await fetchForecast(location.lat, location.lon, units, { signal });
    if (controller !== currentFetchController) {
      return; // superseded
    }
    store.setState({ data, status: 'success', error: null });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return; // superseded by a newer request
    }
    if (controller !== currentFetchController) {
      return;
    }
    store.setState({
      status: 'error',
      error: error && error.message ? error.message : 'Something went wrong',
    });
  } finally {
    if (controller === currentFetchController) {
      currentFetchController = null;
    }
  }
}

function render() {
  const state = store.getState();
  renderApp(state, document);
  if (statusRoot) renderStatus(state, statusRoot);
  const retryBtn = document.querySelector('[data-retry]');
  if (retryBtn) {
    retryBtn.hidden = state.status !== 'error';
  }
  // sync hourly select
  if (hourlySelect && state.data && state.data.daily) {
    const len = state.data.daily.time ? state.data.daily.time.length : 0;
    if (hourlySelect.options.length !== len) {
      hourlySelect.replaceChildren();
      for (let i = 0; i < len; i++) {
        const opt = document.createElement('option');
        opt.value = String(i);
        const d = new Date(state.data.daily.time[i]);
        opt.textContent = d.toLocaleDateString('en-US', { weekday: 'short' });
        hourlySelect.append(opt);
      }
    }
    hourlySelect.value = String(state.selectedDayIndex || 0);
  }
}

store.subscribe(() => render());

// Hourly day selector
if (hourlySelect) {
  hourlySelect.addEventListener('change', () => {
    const idx = Number(hourlySelect.value);
    store.setState({ selectedDayIndex: Number.isFinite(idx) ? idx : 0 });
  });
}

// Time format toggle (12h / 24h)
function syncTimeToggle() {
  if (!timeToggle) return;
  const tf = store.getState().timeFormat;
  timeToggle.textContent = tf === '12h' ? '12h' : '24h';
  timeToggle.setAttribute('aria-pressed', String(tf === '12h'));
}
if (timeToggle) {
  timeToggle.addEventListener('click', () => {
    const current = store.getState().timeFormat;
    const next = current === '12h' ? '24h' : '12h';
    store.setState({ timeFormat: next });
    persist(store.getState());
    syncTimeToggle();
  });
}
store.subscribe(syncTimeToggle);
syncTimeToggle();

// Units dropdown
if (unitsRoot) {
  initUnitsDropdown(unitsRoot, {
    getState: () => store.getState(),
    setState: (partial) => store.setState(partial),
    onChange: (nextState) => {
      const units = nextState?.units ?? store.getState().units;
      persist(store.getState());
      const loc = store.getState().location;
      if (loc) {
        lastFetch = { kind: 'location', payload: loc };
        fetchWeather(loc, units);
      }
    },
  });
}

// Search
if (searchRoot) {
  initSearch(searchRoot, {
    onSelect: (location) => {
      const units = store.getState().units;
      const normalized = {
        name: location.name,
        country: location.country || '',
        lat: location.latitude ?? location.lat,
        lon: location.longitude ?? location.lon,
      };
      store.setState({ location: normalized, selectedDayIndex: 0 });
      persist(store.getState());
      lastFetch = { kind: 'location', payload: normalized };
      fetchWeather(normalized, units);
    },
  });
}

function retryFetch() {
  const state = store.getState();
  if (lastFetch) {
    if (lastFetch.kind === 'coords') {
      fetchWeather(lastFetch.payload, state.units);
    } else {
      fetchWeather(lastFetch.payload, state.units);
    }
  } else {
    boot();
  }
}

async function boot() {
  const persisted = loadPersisted();
  // Auto-detect 12h/24h if the user never chose one: 24h in Europe, 12h
  // elsewhere (based on the location's country; falls back to the browser
  // locale's hour cycle when no country is known).
  let timeFormat = persisted.timeFormat;
  if (!timeFormat) {
    timeFormat = detectTimeFormat(persisted.location?.country);
  }
  if (persisted.location) {
    store.setState({ location: persisted.location, units: persisted.units, timeFormat });
  } else {
    store.setState({ units: persisted.units, timeFormat });
  }

  // Try geolocation first
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8000,
          maximumAge: 600000,
        });
      });
      const coords = {
        name: '',
        country: '',
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };
      // geolocation location has no name; keep lastLocation if present
      const current = store.getState().location;
      const loc = current || coords;
      // If no persisted location, use coords (nameless) - won't be persisted
      if (!current) {
        store.setState({ location: coords });
      }
      // A precise location is available now; drop any stale IP-based cache.
      try { sessionStorage.removeItem('ipLocationCache'); } catch { /* ignore */ }
      lastFetch = { kind: 'coords', payload: coords };
      fetchWeather(coords, store.getState().units);
      return;
    } catch {
      // Geolocation denied or unavailable: try an IP-based best effort before
      // falling back to a persisted place or an empty initial state.
      try {
        const ipLocation = await fetchIpLocation();
        if (ipLocation && Number.isFinite(ipLocation.lat) && Number.isFinite(ipLocation.lon)) {
          const loc = ipLocation.name
            ? ipLocation
            : { ...ipLocation, name: 'Your area' };
          if (!store.getState().location) {
            store.setState({ location: loc });
          }
          lastFetch = { kind: 'location', payload: loc };
          fetchWeather(loc, store.getState().units);
          return;
        }
      } catch {
        // ignore; fall through to persisted/initial
      }
    }
  }

  const loc = store.getState().location;
  if (loc) {
    lastFetch = { kind: 'location', payload: loc };
    fetchWeather(loc, store.getState().units);
  } else {
    store.setState({ status: 'idle' });
  }
}

// Listen for retry event from renderStatus
document.addEventListener('weather:retry', retryFetch);
document.addEventListener('search:empty', () => {
  store.setState({ status: 'empty', error: null });
});
document.addEventListener('search:error', (event) => {
  store.setState({
    status: 'error',
    error: event?.detail?.message || 'Search failed',
  });
});
const retryBtn = document.querySelector('[data-retry]');
if (retryBtn) {
  retryBtn.addEventListener('click', retryFetch);
}

// Initial render + boot
render();
boot().catch((error) => {
  console.error('Boot failed:', error);
  store.setState({ status: 'error', error: 'Could not load weather data' });
});