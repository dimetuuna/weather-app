/**
 * api.js — Open-Meteo data access.
 *
 * Single responsibility: talk to the Open-Meteo geocoding and forecast
 * endpoints, parse their responses defensively, and propagate failures.
 *
 * The module keeps no state and touches no DOM: every function takes its
 * input as arguments and answers with a promise, so it can be unit tested
 * with a mocked `fetch` and reused by any caller.
 */

import { getUnitConfig } from './units.js';

/** Geocoding endpoint: turns a place name into candidate coordinates. */
const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

/** Forecast endpoint: reads current, hourly and daily conditions. */
const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

/** Number of suggestions requested from the geocoding endpoint. */
const SUGGESTION_COUNT = '5';

/** Number of days requested from the forecast endpoint. */
const FORECAST_DAYS = '7';

/** Fields asked for in the `current` block of the forecast. */
const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
].join(',');

/** Fields asked for in the `hourly` block of the forecast. */
const HOURLY_FIELDS = ['temperature_2m', 'weather_code'].join(',');

/** Fields asked for in the `daily` block of the forecast. */
const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
].join(',');

/**
 * Reads a number from an unknown value.
 *
 * Anything that is not a finite number — `null`, `undefined`, a string that
 * does not parse, `NaN` — becomes `null`, so a malformed response can never
 * leak a `NaN` into the UI.
 *
 * @param {unknown} value Value to read.
 * @returns {number|null} The finite number, or `null`.
 */
function toNumberOrNull(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Reads a string from an unknown value.
 *
 * @param {unknown} value Value to read.
 * @returns {string|null} The string, or `null` when the value is not text.
 */
function toTextOrNull(value) {
  return typeof value === 'string' ? value : null;
}

/**
 * Reads a text field that the UI always renders.
 *
 * @param {unknown} value Value to read.
 * @returns {string} The string, or an empty string when there is none.
 */
function toTextOrEmpty(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * Reads a latitude or longitude.
 *
 * `null` and `undefined` are rejected before coercion because `Number(null)`
 * is `0`, which would silently request the Gulf of Guinea.
 *
 * @param {unknown} value Value to read.
 * @returns {number|null} The coordinate, or `null` when it is not a number.
 */
function toCoordinate(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Pads or truncates a list to the given length and coerces every entry.
 *
 * @param {unknown[]} list Source list.
 * @param {number} length Target length.
 * @param {Function} coerce Coercer applied to every entry.
 * @returns {Array} List of exactly `length` entries.
 */
function padTo(list, length, coerce) {
  const padded = list.slice(0, length);
  while (padded.length < length) {
    padded.push(null);
  }
  return padded.map(coerce);
}

/**
 * Builds a time series where every array shares the same length.
 *
 * The `time` array is the spine of the series: every other array is
 * truncated or padded to the length of the longest one, so a renderer can
 * zip the arrays without ever reading `undefined`. A missing entry becomes
 * `null` instead.
 *
 * @param {object} block Raw block read from the API response.
 * @param {object} spec Coercer for every value array of the series.
 * @returns {object} The normalized series.
 */
function buildSeries(block, spec) {
  const source = block && typeof block === 'object' ? block : {};
  const times = Array.isArray(source.time) ? source.time : [];
  const entries = Object.entries(spec);
  const lists = entries.map(([key]) => (Array.isArray(source[key]) ? source[key] : []));
  const length = lists.reduce(
    (longest, list) => Math.max(longest, list.length),
    times.length,
  );

  const series = { time: padTo(times, length, toTextOrNull) };
  entries.forEach(([key, coerce], index) => {
    series[key] = padTo(lists[index], length, coerce);
  });
  return series;
}

/**
 * Normalizes the `current` block of a forecast response.
 *
 * @param {object} block Raw block read from the API response.
 * @returns {object} The current conditions, with `null` for missing values.
 */
function parseCurrent(block) {
  const source = block && typeof block === 'object' ? block : {};
  return {
    time: toTextOrEmpty(source.time),
    temperature: toNumberOrNull(source.temperature_2m),
    apparent_temperature: toNumberOrNull(source.apparent_temperature),
    humidity: toNumberOrNull(source.relative_humidity_2m),
    precipitation: toNumberOrNull(source.precipitation),
    weather_code: toNumberOrNull(source.weather_code),
    wind_speed: toNumberOrNull(source.wind_speed_10m),
  };
}

/**
 * Maps one geocoding result to the location shape the app works with.
 *
 * @param {object} result Raw result read from the API response.
 * @returns {object} The normalized location.
 */
function mapLocation(result) {
  const source = result && typeof result === 'object' ? result : {};
  return {
    name: toTextOrEmpty(source.name),
    country: toTextOrEmpty(source.country),
    admin1: toTextOrEmpty(source.admin1),
    lat: toNumberOrNull(source.latitude),
    lon: toNumberOrNull(source.longitude),
  };
}

/**
 * Resolves the unit configuration of a unit system.
 *
 * Accepts a unit key or a unit configuration object, so a caller can pass
 * either the key stored in the state or the configuration it read.
 *
 * @param {string|object} units Unit system key or configuration.
 * @returns {object} The matching unit configuration.
 */
function resolveUnitConfig(units) {
  const key = typeof units === 'object' && units !== null ? units.key : units;
  return getUnitConfig(key);
}

/**
 * Searches places by name.
 *
 * An empty or blank query never reaches the network: it answers with an
 * empty array right away, which keeps the autocomplete from flashing an
 * empty list on every keystroke.
 *
 * @param {string} query Place name to look for.
 * @param {object} [options] Request options.
 * @param {AbortSignal} [options.signal] Signal used to cancel the request.
 * @returns {Promise<Array<{name: string, country: string, admin1: string, lat: number|null, lon: number|null}>>}
 *   The matching locations, or an empty array when there is no match.
 */
export async function searchLocations(query, { signal } = {}) {
  if (typeof query !== 'string' || query.trim() === '') {
    return [];
  }

  const url = new URL(GEOCODING_ENDPOINT);
  url.searchParams.set('name', query.trim());
  url.searchParams.set('count', SUGGESTION_COUNT);
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Geocoding request failed (${response.status})`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.results)) {
    return [];
  }
  return payload.results.map(mapLocation);
}

/**
 * Reads the forecast of a pair of coordinates.
 *
 * The unit system is sent to the API as query parameters — the app never
 * converts values on its own.
 *
 * @param {number|string} lat Latitude of the place.
 * @param {number|string} lon Longitude of the place.
 * @param {string|object} units Unit system key or configuration.
 * @param {object} [options] Request options.
 * @param {AbortSignal} [options.signal] Signal used to cancel the request.
 * @returns {Promise<{current: object, daily: object, hourly: object}>} The forecast.
 */
export async function fetchForecast(lat, lon, units, { signal } = {}) {
  const latitude = toCoordinate(lat);
  const longitude = toCoordinate(lon);
  if (latitude === null || longitude === null) {
    throw new Error('Invalid coordinates: latitude and longitude must be numbers');
  }

  const url = new URL(FORECAST_ENDPOINT);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('current', CURRENT_FIELDS);
  url.searchParams.set('hourly', HOURLY_FIELDS);
  url.searchParams.set('daily', DAILY_FIELDS);
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', FORECAST_DAYS);
  for (const [key, value] of Object.entries(resolveUnitConfig(units).apiParams)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Forecast request failed (${response.status})`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== 'object') {
    throw new Error('Forecast response was empty or invalid');
  }

  return {
    current: parseCurrent(payload.current),
    daily: buildSeries(payload.daily, {
      temperature_2m_max: toNumberOrNull,
      temperature_2m_min: toNumberOrNull,
      weather_code: toNumberOrNull,
    }),
    hourly: buildSeries(payload.hourly, {
      temperature_2m: toNumberOrNull,
      weather_code: toNumberOrNull,
    }),
  };
}

/**
 * Alias of {@link fetchForecast}, named after the way the app asks for the
 * weather of a place: by its coordinates.
 *
 * @type {typeof fetchForecast}
 */
export const fetchByCoords = fetchForecast;

/**
 * Best-effort location derived from the visitor's IP address.
 *
 * Used as a fallback when the browser's Geolocation API is unavailable or
 * denied, so the app can still show local weather without forcing a search.
 * Returns `null` when the lookup fails or the service's answer is unusable,
 * so callers can fall back to a persisted place or an empty initial state.
 *
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{name: string, country: string, lat: number, lon: number} | null>}
 */
export async function fetchIpLocation({ signal } = {}) {
  let response;
  try {
    response = await fetch('https://ipapi.co/json/', { signal });
  } catch {
    return null;
  }
  if (!response || !response.ok) {
    return null;
  }
  let data;
  try {
    data = await response.json();
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') {
    return null;
  }
  const lat = Number(data.latitude);
  const lon = Number(data.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }
  return {
    name: typeof data.city === 'string' && data.city.trim() !== '' ? data.city.trim() : '',
    country: typeof data.country_name === 'string' ? data.country_name.trim() : '',
    lat,
    lon,
  };
}
