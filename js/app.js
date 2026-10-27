/**
 * app.js - application entry point.
 *
 * Single responsibility: bootstrap the app and wire the modules together
 * (store <-> api <-> ui), including the geolocation-first boot sequence.
 */

import { createStore, loadPersisted, persist } from './state.js';
import { fetchForecast, fetchByCoords, searchLocations, fetchIpLocation } from './api.js';
import { getUnitConfig } from './units.js';
import { renderApp, renderStatus } from './ui.js';
import { initSearch } from './search.js';
import { initUnitsDropdown } from './ui.js';

const root = document;

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

let lastFetch = null; // { kind: 'coords'|'location', payload }

async function fetchWeather(location, units) {
  store.setState({ status: 'loading', error: null });
  try {
    const data =
      location && location.lat != null && location.lon != null && !location.name
        ? await fetchByCoords(location.lat, location.lon, units)
        : await fetchForecast(location.lat, location.lon, units);
    store.setState({ data, status: 'success', error: null });
  } catch (error) {
    store.setState({
      status: 'error',
      error: error && error.message ? error.message : 'Something went wrong',
    });
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

// Units dropdown
if (unitsRoot) {
  initUnitsDropdown(unitsRoot, {
    getState: () => store.getState(),
    setState: (partial) => store.setState(partial),
    onChange: (units) => {
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
  if (persisted.location) {
    store.setState({ location: persisted.location, units: persisted.units });
  } else {
    store.setState({ units: persisted.units });
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
      // If no persisted location, use coords (nameless) — won't be persisted
      if (!current) {
        store.setState({ location: coords });
      }
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
boot();