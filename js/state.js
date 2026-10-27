/**
 * state.js — application state.
 *
 * Single responsibility: hold the observable store (location, units,
 * selectedDayIndex, status, data, error) and persist `units` / `lastLocation`
 * to localStorage.
 *
 * The module touches no DOM and knows nothing about the network: it stores
 * what the app knows and tells its subscribers when that knowledge changes.
 * `js/api.js` fills the `data` field, `js/ui.js` renders it.
 *
 * Every value that comes from the outside — a stored preference, a partial
 * update — is validated before it is kept, so a corrupted `localStorage`
 * entry or a malformed update can never break the render. Every value that
 * goes out to a consumer is a protected snapshot, so a consumer can never
 * change the state the store keeps.
 */

import { UNITS } from './units.js';

/**
 * The `localStorage` keys the app remembers its preferences under.
 *
 * `units` holds the unit system as a plain string (`metric` / `imperial`),
 * `lastLocation` holds the last searched place as a JSON object.
 */
export const STORAGE_KEYS = Object.freeze({
  units: 'units',
  lastLocation: 'lastLocation',
});

/**
 * The states the interface can be in.
 *
 * `idle` before anything was requested, `loading` while a request is in
 * flight, `success` when a forecast is displayed, `empty` when the request
 * succeeded but found nothing to show, `error` when the request failed.
 */
export const STATUSES = Object.freeze(['idle', 'loading', 'success', 'empty', 'error']);

/**
 * The state the app starts in when nothing is known yet.
 *
 * Frozen, so no consumer can corrupt the defaults every fresh store starts
 * from.
 */
export const DEFAULT_STATE = Object.freeze({
  location: null,
  units: 'metric',
  selectedDayIndex: 0,
  status: 'idle',
  data: null,
  error: null,
});

/**
 * Tells whether a value names one of the supported unit systems.
 *
 * The check goes through `UNITS`, the single source of truth built in the
 * "units definitions" task, so a new unit system is recognized here as soon
 * as it is added there.
 *
 * @param {unknown} value Value to check.
 * @returns {boolean} True for `'metric'` and `'imperial'`.
 */
export function isValidUnits(value) {
  return typeof value === 'string' && Object.hasOwn(UNITS, value);
}

/**
 * Tells whether a value names one of the interface states.
 *
 * @param {unknown} value Value to check.
 * @returns {boolean} True for the five known statuses.
 */
export function isValidStatus(value) {
  return typeof value === 'string' && STATUSES.includes(value);
}

/**
 * Tells whether a value is a usable day index.
 *
 * @param {unknown} value Value to check.
 * @returns {boolean} True for a non-negative integer.
 */
export function isValidDayIndex(value) {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Tells whether a value is a usable location.
 *
 * A location needs a name and a country to be rendered, and finite
 * coordinates inside the valid ranges to be fetched. A name or a country
 * that is blank carries no information, so it is rejected as well — a
 * place called " " is worse than no place at all, because the interface
 * would render an empty city name. Extra properties (the geocoding layer
 * also reports `admin1`) are accepted and dropped later.
 *
 * @param {unknown} value Value to check.
 * @returns {boolean} True for a well-formed location.
 */
export function isValidLocation(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const { name, country, lat, lon } = value;
  if (typeof name !== 'string' || typeof country !== 'string') {
    return false;
  }
  if (name.trim() === '' || country.trim() === '') {
    return false;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return false;
  }

  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * Tells whether a value is a usable forecast.
 *
 * The forecast is the `{ current, daily, hourly }` triple produced by
 * `js/api.js`; all three blocks must be present.
 *
 * @param {unknown} value Value to check.
 * @returns {boolean} True for a well-formed forecast.
 */
export function isForecastData(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return ['current', 'daily', 'hourly'].every(
    (key) => value[key] && typeof value[key] === 'object',
  );
}

/**
 * Copies a value deeply, so the copy shares nothing with the original.
 *
 * `structuredClone` does the work when the runtime has it (every current
 * browser, and Node 17+); the manual walk is the fallback for the older
 * ones. Both only have to handle plain objects and arrays, which is all
 * the state ever holds.
 *
 * @param {unknown} value Value to copy.
 * @returns {unknown} A copy that shares nothing with `value`.
 */
function deepClone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // A value `structuredClone` refuses (a function, a DOM node) is
      // copied by hand below.
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item));
  }

  const copy = {};
  for (const [key, item] of Object.entries(value)) {
    copy[key] = deepClone(item);
  }

  return copy;
}

/**
 * Builds the protected copy of the state that leaves the store.
 *
 * The flat fields are primitives and need no more than a copy; the nested
 * ones (`location`, `data`) are cloned. A consumer — a renderer, a
 * subscriber — that changes what it received therefore changes its own
 * copy and nothing else: the state the store keeps stays untouched.
 *
 * @param {object} state State to copy.
 * @returns {object} A snapshot that shares nothing with `state`.
 */
function snapshotState(state) {
  return {
    location: deepClone(state.location),
    units: state.units,
    selectedDayIndex: state.selectedDayIndex,
    status: state.status,
    data: deepClone(state.data),
    error: state.error,
  };
}

/**
 * Brings a location into the shape the state stores.
 *
 * @param {unknown} value Location to normalize.
 * @returns {{name: string, country: string, lat: number, lon: number}|null}
 *   The normalized location, or `null` when the value is not usable.
 */
function normalizeLocation(value) {
  if (!isValidLocation(value)) {
    return null;
  }

  return {
    name: value.name,
    country: value.country,
    lat: value.lat,
    lon: value.lon,
  };
}

/**
 * Brings an arbitrary value into the state shape.
 *
 * Missing and malformed fields fall back to their default rather than
 * throwing, so a bad update can never leave the app in a broken state.
 * The forecast is copied, so the store owns its data and the caller cannot
 * change it behind the store's back.
 *
 * @param {unknown} value Value to normalize.
 * @returns {object} A complete, valid state object.
 */
function normalizeState(value) {
  const source = value && typeof value === 'object' ? value : {};

  return {
    location: normalizeLocation(source.location),
    units: isValidUnits(source.units) ? source.units : DEFAULT_STATE.units,
    selectedDayIndex: isValidDayIndex(source.selectedDayIndex)
      ? source.selectedDayIndex
      : DEFAULT_STATE.selectedDayIndex,
    status: isValidStatus(source.status) ? source.status : DEFAULT_STATE.status,
    data: isForecastData(source.data) ? deepClone(source.data) : null,
    error:
      typeof source.error === 'string' && source.error.trim() !== ''
        ? source.error
        : null,
  };
}

/**
 * Reads the storage to work with.
 *
 * `undefined` asks for the browser's `localStorage`; `null` asks for no
 * storage at all, which is what a server-side render or a test without a
 * DOM needs. Reading the global can throw in a sandboxed frame, hence the
 * `try`/`catch`.
 *
 * @param {Storage|null|undefined} [candidate] Storage to use.
 * @returns {Storage|null} The storage, or `null` when there is none.
 */
function resolveStorage(candidate) {
  if (candidate === undefined) {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  return candidate ?? null;
}

/**
 * Reads one key from the storage.
 *
 * @param {Storage|null} storage Storage to read from.
 * @param {string} key Key to read.
 * @returns {string|null} The stored value, or `null` when it is missing.
 */
function readItem(storage, key) {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(key);
    return typeof raw === 'string' ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Writes one key to the storage.
 *
 * @param {Storage|null} storage Storage to write to.
 * @param {string} key Key to write.
 * @param {string} value Value to store.
 * @returns {boolean} True when the value was stored.
 */
function writeItem(storage, key, value) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses a JSON string without throwing.
 *
 * @param {string} raw String to parse.
 * @returns {unknown} The parsed value, or `null` when it is not valid JSON.
 */
function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Reads the persisted preferences.
 *
 * The unit system falls back to metric and the last location to `null`
 * whenever the stored value is missing, malformed or of the wrong shape — a
 * corrupted entry must never stop the app from starting.
 *
 * The answer uses the *state* names, so it can seed a store directly:
 * `createStore({ ...DEFAULT_STATE, ...loadPersisted() })`. The location is
 * stored under the `lastLocation` key.
 *
 * @param {Storage|null} [storage] Storage to read from. Defaults to the
 *   browser's `localStorage`; pass `null` to read nothing.
 * @returns {{units: string, location: object|null}} The persisted
 *   preferences, in the state shape.
 */
export function loadPersisted(storage = undefined) {
  const store = resolveStorage(storage);

  const rawUnits = readItem(store, STORAGE_KEYS.units);
  let units = DEFAULT_STATE.units;
  if (rawUnits !== null) {
    const trimmed = rawUnits.trim();
    const parsed = safeParse(trimmed);
    const candidate = typeof parsed === 'string' ? parsed : trimmed;
    if (isValidUnits(candidate)) {
      units = candidate;
    }
  }

  const rawLocation = readItem(store, STORAGE_KEYS.lastLocation);
  const location = rawLocation === null ? null : normalizeLocation(safeParse(rawLocation));

  return { units, location };
}

/**
 * Writes the preferences the app wants to remember.
 *
 * The unit system is always written. The last location is only written when
 * it is a complete place with a name — a location that only carries
 * coordinates (the one the geolocation API returns) has no name to display,
 * and it would replace a named place the user actually searched for. Nothing
 * is ever removed, so a saved place survives until a new one replaces it.
 *
 * @param {object} state Current state.
 * @param {Storage|null} [storage] Storage to write to. Defaults to the
 *   browser's `localStorage`; pass `null` to write nothing.
 * @returns {boolean} True when at least one value was stored.
 */
export function persist(state, storage = undefined) {
  const store = resolveStorage(storage);
  if (!store) {
    return false;
  }

  const source = state && typeof state === 'object' ? state : {};
  const units = isValidUnits(source.units) ? source.units : DEFAULT_STATE.units;
  let written = writeItem(store, STORAGE_KEYS.units, units);

  const location = normalizeLocation(source.location);
  if (location && location.name.trim() !== '') {
    written = writeItem(store, STORAGE_KEYS.lastLocation, JSON.stringify(location)) || written;
  }

  return written;
}

/**
 * How many updates a single `setState` call may cascade through.
 *
 * A subscriber that answers every notification with another update would
 * otherwise loop forever. The cap keeps the loop finite; the surplus
 * updates are dropped and reported.
 */
const MAX_CASCADING_UPDATES = 50;

/**
 * Creates an observable store.
 *
 * The store keeps a single state object and notifies its subscribers
 * whenever that object changes. It is deliberately tiny: no middleware, no
 * action types, no batching — the app has one state and one place that
 * changes it.
 *
 * The state the store keeps is private: `getState` and the subscribers
 * receive protected snapshots, so nobody can change what the store holds
 * from the outside.
 *
 * @param {object} [initial] Initial state. Missing or invalid fields fall
 *   back to {@link DEFAULT_STATE}.
 * @returns {{getState: Function, setState: Function, subscribe: Function}}
 *   The store.
 */
export function createStore(initial = DEFAULT_STATE) {
  let state = normalizeState(initial);
  const listeners = new Set();
  let isNotifying = false;
  const pendingUpdates = [];

  /**
   * Reads the current state.
   *
   * A protected snapshot is returned: the nested `location` and `data` are
   * copied, so a caller cannot change the state by accident — neither at
   * the top level nor inside the forecast.
   *
   * @returns {object} A snapshot of the current state.
   */
  function getState() {
    return snapshotState(state);
  }

  /**
   * Merges a partial state into the current one.
   *
   * Invalid fields fall back to their default instead of being stored, so
   * the state always holds usable values.
   *
   * @param {object} partial Fields to change.
   * @returns {{next: object, previous: object}} The new and the old state.
   */
  function applyUpdate(partial) {
    const previous = state;
    state = normalizeState({ ...state, ...partial });

    return { next: state, previous };
  }

  /**
   * Tells every subscriber about a change.
   *
   * The pair of states is fixed for the whole cycle, so every subscriber
   * of this cycle sees the same "this is new, that was old" — even when a
   * subscriber changes the state again while being notified. Each
   * subscriber gets its own snapshot, so one of them cannot corrupt what
   * the others receive.
   *
   * @param {object} next The new state.
   * @param {object} previous The state before the change.
   */
  function notify(next, previous) {
    for (const listener of [...listeners]) {
      try {
        listener(snapshotState(next), snapshotState(previous));
      } catch (error) {
        // A broken subscriber must not keep the other ones from updating.
        console.error('State subscriber failed:', error);
      }
    }
  }

  /**
   * Merges a partial state into the current one and notifies the
   * subscribers.
   *
   * A call that comes from inside a notification (a subscriber that
   * updates the state while it is being told about a change) is queued:
   * it is applied once the current cycle is over, so the subscribers of
   * this cycle all see a consistent pair of states.
   *
   * @param {object} partial Fields to change.
   * @returns {object} A snapshot of the new state.
   */
  function setState(partial) {
    if (!partial || typeof partial !== 'object') {
      return getState();
    }

    if (isNotifying) {
      // Reentrant call: hold it back until the current cycle is done.
      pendingUpdates.push(partial);
      return getState();
    }

    isNotifying = true;
    try {
      const { next, previous } = applyUpdate(partial);
      notify(next, previous);

      let cascaded = 0;
      while (pendingUpdates.length > 0) {
        if (cascaded >= MAX_CASCADING_UPDATES) {
          console.error(
            'State: too many cascading updates, the rest were dropped.',
          );
          pendingUpdates.length = 0;
          break;
        }

        const queued = pendingUpdates.shift();
        const update = applyUpdate(queued);
        notify(update.next, update.previous);
        cascaded += 1;
      }
    } finally {
      isNotifying = false;
      pendingUpdates.length = 0;
    }

    return getState();
  }

  /**
   * Registers a function called on every state change.
   *
   * The subscriber receives the new and the previous state as protected
   * snapshots: it may read them, but not change what the store holds.
   *
   * @param {(state: object, previousState: object) => void} listener
   *   Function to call.
   * @returns {() => void} A function that removes the listener again.
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { getState, setState, subscribe };
}
