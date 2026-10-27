import { describe, expect, it, vi } from 'vitest';
import * as stateModule from '../js/state.js';

const {
  DEFAULT_STATE,
  STATUSES,
  STORAGE_KEYS,
  createStore,
  isForecastData,
  isValidDayIndex,
  isValidLocation,
  isValidStatus,
  isValidUnits,
  loadPersisted,
  persist,
} = stateModule;

/**
 * In-memory stand-in for `localStorage`.
 *
 * The state module only ever calls `getItem` and `setItem`, so a plain object
 * is enough — and it keeps the tests independent from the browser storage
 * the jsdom environment provides.
 */
function createStorage(initial = {}) {
  const map = new Map(Object.entries(initial));

  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    get size() {
      return map.size;
    },
  };
}

/** A location as the geocoding layer produces it. */
const BERLIN = {
  name: 'Berlin',
  country: 'Germany',
  lat: 52.52437,
  lon: 13.41053,
};

/** A forecast as the API layer produces it. */
const FORECAST = {
  current: { time: '2026-10-27T12:00', temperature: 14 },
  daily: { time: ['2026-10-27'] },
  hourly: { time: ['2026-10-27T12:00'] },
};

describe('js/state.js', () => {
  describe('constants', () => {
    it('describes the five interface states', () => {
      expect(STATUSES).toEqual(['idle', 'loading', 'success', 'empty', 'error']);
    });

    it('starts from a frozen default state', () => {
      expect(DEFAULT_STATE).toEqual({
        location: null,
        units: 'metric',
        selectedDayIndex: 0,
        status: 'idle',
        data: null,
        error: null,
      });
      expect(Object.isFrozen(DEFAULT_STATE)).toBe(true);
    });

    it('stores the preferences under the documented keys', () => {
      expect(STORAGE_KEYS).toEqual({ units: 'units', lastLocation: 'lastLocation' });
    });
  });

  describe('validators', () => {
    it('accepts only the two unit systems', () => {
      expect(isValidUnits('metric')).toBe(true);
      expect(isValidUnits('imperial')).toBe(true);
      expect(isValidUnits('kelvin')).toBe(false);
      expect(isValidUnits('')).toBe(false);
      expect(isValidUnits(null)).toBe(false);
      expect(isValidUnits(undefined)).toBe(false);
    });

    it('accepts only the five interface states', () => {
      expect(isValidStatus('idle')).toBe(true);
      expect(isValidStatus('error')).toBe(true);
      expect(isValidStatus('loading')).toBe(true);
      expect(isValidStatus('done')).toBe(false);
      expect(isValidStatus(undefined)).toBe(false);
    });

    it('accepts only non-negative integer day indexes', () => {
      expect(isValidDayIndex(0)).toBe(true);
      expect(isValidDayIndex(6)).toBe(true);
      expect(isValidDayIndex(-1)).toBe(false);
      expect(isValidDayIndex(1.5)).toBe(false);
      expect(isValidDayIndex('2')).toBe(false);
    });

    it('accepts a complete location', () => {
      expect(isValidLocation(BERLIN)).toBe(true);
    });

    it('rejects a location without a name, a country or usable coordinates', () => {
      expect(isValidLocation({ ...BERLIN, name: 42 })).toBe(false);
      expect(isValidLocation({ ...BERLIN, country: null })).toBe(false);
      expect(isValidLocation({ ...BERLIN, lat: 'north' })).toBe(false);
      expect(isValidLocation({ ...BERLIN, lon: Number.NaN })).toBe(false);
      expect(isValidLocation(null)).toBe(false);
      expect(isValidLocation(undefined)).toBe(false);
    });

    it('rejects coordinates outside the valid ranges', () => {
      expect(isValidLocation({ ...BERLIN, lat: 91 })).toBe(false);
      expect(isValidLocation({ ...BERLIN, lon: 181 })).toBe(false);
    });

    it('accepts a forecast with the three blocks and rejects anything else', () => {
      expect(isForecastData(FORECAST)).toBe(true);
      expect(isForecastData({ current: {}, daily: {} })).toBe(false);
      expect(isForecastData(null)).toBe(false);
    });
  });

  describe('createStore()', () => {
    it('starts from the default state', () => {
      const store = createStore();

      expect(store.getState()).toEqual({
        location: null,
        units: 'metric',
        selectedDayIndex: 0,
        status: 'idle',
        data: null,
        error: null,
      });
    });

    it('accepts an initial state', () => {
      const store = createStore({ ...DEFAULT_STATE, units: 'imperial', status: 'loading' });

      expect(store.getState().units).toBe('imperial');
      expect(store.getState().status).toBe('loading');
    });

    it('completes a partial initial state with the defaults', () => {
      const store = createStore({ units: 'imperial' });

      expect(store.getState()).toEqual({
        location: null,
        units: 'imperial',
        selectedDayIndex: 0,
        status: 'idle',
        data: null,
        error: null,
      });
    });

    it('merges a partial update into the current state', () => {
      const store = createStore();

      store.setState({ status: 'loading' });
      store.setState({ units: 'imperial' });

      expect(store.getState()).toEqual({
        location: null,
        units: 'imperial',
        selectedDayIndex: 0,
        status: 'loading',
        data: null,
        error: null,
      });
    });

    it('keeps the fields an update does not mention', () => {
      const store = createStore();

      store.setState({ location: BERLIN, status: 'success', data: FORECAST });
      store.setState({ selectedDayIndex: 3 });

      const state = store.getState();
      expect(state.location).toEqual(BERLIN);
      expect(state.status).toBe('success');
      expect(state.data).toEqual(FORECAST);
      expect(state.selectedDayIndex).toBe(3);
    });

    it('replaces the location as a whole', () => {
      const store = createStore({ location: BERLIN });

      store.setState({ location: { name: 'Paris', country: 'France', lat: 48.85, lon: 2.35 } });

      expect(store.getState().location).toEqual({
        name: 'Paris',
        country: 'France',
        lat: 48.85,
        lon: 2.35,
      });
    });

    it('falls back to metric for an invalid unit system', () => {
      const store = createStore({ units: 'imperial' });

      store.setState({ units: 'kelvin' });

      expect(store.getState().units).toBe('metric');
    });

    it('falls back to idle for an invalid status', () => {
      const store = createStore({ status: 'loading' });

      store.setState({ status: 'exploded' });

      expect(store.getState().status).toBe('idle');
    });

    it('falls back to zero for an invalid day index', () => {
      const store = createStore({ selectedDayIndex: 2 });

      store.setState({ selectedDayIndex: -3 });

      expect(store.getState().selectedDayIndex).toBe(0);
    });

    it('drops an invalid location', () => {
      const store = createStore({ location: BERLIN });

      store.setState({ location: { name: 'Nowhere', country: 'Nowhere', lat: 'x', lon: 'y' } });

      expect(store.getState().location).toBeNull();
    });

    it('clears the location when it is set to null', () => {
      const store = createStore({ location: BERLIN });

      store.setState({ location: null });

      expect(store.getState().location).toBeNull();
    });

    it('drops a malformed forecast', () => {
      const store = createStore();

      store.setState({ data: { current: {} } });

      expect(store.getState().data).toBeNull();
    });

    it('empties an empty error message', () => {
      const store = createStore();

      store.setState({ error: 'Boom' });
      expect(store.getState().error).toBe('Boom');

      store.setState({ error: '   ' });
      expect(store.getState().error).toBeNull();
    });

    it('ignores an update that is not an object', () => {
      const store = createStore();

      store.setState(null);
      store.setState('status=loading');
      store.setState(undefined);

      expect(store.getState()).toEqual(DEFAULT_STATE);
    });

    it('hands out a copy, so the state cannot be changed from the outside', () => {
      const store = createStore();

      const state = store.getState();
      state.status = 'error';

      expect(store.getState().status).toBe('idle');
    });

    it('answers with the new state when it is updated', () => {
      const store = createStore();

      const state = store.setState({ status: 'loading' });

      expect(state.status).toBe('loading');
      expect(state).toEqual(store.getState());
    });
  });

  describe('subscribe(fn)', () => {
    it('notifies the subscriber when the state changes', () => {
      const store = createStore();
      const listener = vi.fn();

      store.subscribe(listener);
      store.setState({ status: 'loading' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('hands the new and the previous state to the subscriber', () => {
      const store = createStore();
      const listener = vi.fn();

      store.subscribe(listener);
      store.setState({ status: 'loading' });

      const [next, previous] = listener.mock.calls[0];
      expect(next.status).toBe('loading');
      expect(previous.status).toBe('idle');
      expect(previous).not.toBe(next);
    });

    it('notifies every subscriber', () => {
      const store = createStore();
      const first = vi.fn();
      const second = vi.fn();

      store.subscribe(first);
      store.subscribe(second);
      store.setState({ units: 'imperial' });

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after the returned unsubscribe function is called', () => {
      const store = createStore();
      const listener = vi.fn();

      const unsubscribe = store.subscribe(listener);
      unsubscribe();
      store.setState({ status: 'loading' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('returns a function that can be called more than once', () => {
      const store = createStore();
      const listener = vi.fn();

      const unsubscribe = store.subscribe(listener);
      unsubscribe();
      unsubscribe();
      store.setState({ status: 'loading' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('keeps notifying the other subscribers when one of them throws', () => {
      const store = createStore();
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failing = vi.fn(() => {
        throw new Error('Boom');
      });
      const working = vi.fn();

      store.subscribe(failing);
      store.subscribe(working);
      store.setState({ status: 'loading' });

      expect(failing).toHaveBeenCalledTimes(1);
      expect(working).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalled();

      error.mockRestore();
    });

    it('ignores a subscriber that is not a function', () => {
      const store = createStore();

      const unsubscribe = store.subscribe('not a function');

      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();
      expect(() => store.setState({ status: 'loading' })).not.toThrow();
    });
  });

  describe('persist(state)', () => {
    it('writes the unit system and the last location', () => {
      const storage = createStorage();

      const written = persist({ ...DEFAULT_STATE, units: 'imperial', location: BERLIN }, storage);

      expect(written).toBe(true);
      expect(storage.getItem(STORAGE_KEYS.units)).toBe('imperial');
      expect(JSON.parse(storage.getItem(STORAGE_KEYS.lastLocation))).toEqual(BERLIN);
    });

    it('writes metric when the unit system is invalid', () => {
      const storage = createStorage();

      persist({ ...DEFAULT_STATE, units: 'kelvin' }, storage);

      expect(storage.getItem(STORAGE_KEYS.units)).toBe('metric');
    });

    it('keeps a stored place when the current location has no name', () => {
      const storage = createStorage();
      persist({ ...DEFAULT_STATE, location: BERLIN }, storage);

      persist({ ...DEFAULT_STATE, location: { name: '', country: '', lat: 52.5, lon: 13.4 } }, storage);

      expect(JSON.parse(storage.getItem(STORAGE_KEYS.lastLocation))).toEqual(BERLIN);
    });

    it('writes nothing when there is no storage', () => {
      expect(persist({ ...DEFAULT_STATE, units: 'imperial' }, null)).toBe(false);
    });

    it('survives a storage that refuses to write', () => {
      const storage = {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      };

      expect(() => persist({ ...DEFAULT_STATE, units: 'imperial' }, storage)).not.toThrow();
      expect(persist({ ...DEFAULT_STATE, units: 'imperial' }, storage)).toBe(false);
    });
  });

  describe('loadPersisted()', () => {
    it('answers with the defaults when nothing was stored', () => {
      const storage = createStorage();

      expect(loadPersisted(storage)).toEqual({ units: 'metric', location: null });
    });

    it('reads the stored unit system and location', () => {
      const storage = createStorage({
        [STORAGE_KEYS.units]: 'imperial',
        [STORAGE_KEYS.lastLocation]: JSON.stringify(BERLIN),
      });

      expect(loadPersisted(storage)).toEqual({ units: 'imperial', location: BERLIN });
    });

    it('falls back to metric for an invalid stored unit system', () => {
      const storage = createStorage({ [STORAGE_KEYS.units]: 'kelvin' });

      expect(loadPersisted(storage).units).toBe('metric');
    });

    it('drops a last location that is not valid JSON', () => {
      const storage = createStorage({ [STORAGE_KEYS.lastLocation]: '{not json' });

      expect(loadPersisted(storage).location).toBeNull();
    });

    it('drops a last location of the wrong shape', () => {
      const storage = createStorage({
        [STORAGE_KEYS.lastLocation]: JSON.stringify({ name: 'Berlin' }),
      });

      expect(loadPersisted(storage).location).toBeNull();
    });

    it('drops a last location with coordinates outside the valid ranges', () => {
      const storage = createStorage({
        [STORAGE_KEYS.lastLocation]: JSON.stringify({ ...BERLIN, lat: 500 }),
      });

      expect(loadPersisted(storage).location).toBeNull();
    });

    it('answers with the defaults when there is no storage', () => {
      expect(loadPersisted(null)).toEqual({ units: 'metric', location: null });
    });

    it('survives a storage that refuses to read', () => {
      const storage = {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {},
      };

      expect(() => loadPersisted(storage)).not.toThrow();
      expect(loadPersisted(storage)).toEqual({ units: 'metric', location: null });
    });
  });

  describe('persistence round trip', () => {
    it('restores what was written', () => {
      const storage = createStorage();

      persist({ ...DEFAULT_STATE, units: 'imperial', location: BERLIN }, storage);
      const restored = loadPersisted(storage);

      expect(restored.units).toBe('imperial');
      expect(restored.location).toEqual(BERLIN);
    });

    it('seeds a fresh store with the restored preferences', () => {
      const storage = createStorage();
      persist({ ...DEFAULT_STATE, units: 'imperial', location: BERLIN }, storage);

      const store = createStore({ ...DEFAULT_STATE, ...loadPersisted(storage) });

      expect(store.getState().units).toBe('imperial');
      expect(store.getState().location).toEqual(BERLIN);
    });

    it('uses the browser storage when no storage is given', () => {
      localStorage.clear();

      persist({ ...DEFAULT_STATE, units: 'imperial', location: BERLIN });
      const restored = loadPersisted();

      expect(restored.units).toBe('imperial');
      expect(restored.location).toEqual(BERLIN);
      expect(localStorage.getItem(STORAGE_KEYS.units)).toBe('imperial');

      localStorage.clear();
    });
  });
});
