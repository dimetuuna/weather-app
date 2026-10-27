import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../js/api.js';
import { UNITS } from '../js/units.js';

const { searchLocations, fetchForecast, fetchByCoords } = api;

/**
 * Minimal Response stand-in — the API layer only reads `ok`, `status` and
 * `json()`, so building a real `Response` would only add noise.
 */
function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

/** Reads the URL of the nth request made to the mocked fetch. */
function requestedUrl(fetchMock, index = 0) {
  return new URL(fetchMock.mock.calls[index][0]);
}

describe('js/api.js', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('searchLocations(query)', () => {
    it('does not touch the network for an empty query', async () => {
      await expect(searchLocations('')).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not touch the network for a whitespace-only query', async () => {
      await expect(searchLocations('   ')).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not touch the network for a non-string query', async () => {
      await expect(searchLocations(null)).resolves.toEqual([]);
      await expect(searchLocations(undefined)).resolves.toEqual([]);
      await expect(searchLocations(42)).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('requests the geocoding endpoint with the expected parameters', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ results: [] }));

      await searchLocations('Berlin');

      const url = requestedUrl(fetchMock);
      expect(url.origin + url.pathname).toBe(
        'https://geocoding-api.open-meteo.com/v1/search',
      );
      expect(url.searchParams.get('name')).toBe('Berlin');
      expect(url.searchParams.get('count')).toBe('5');
      expect(url.searchParams.get('language')).toBe('en');
      expect(url.searchParams.get('format')).toBe('json');
    });

    it('searches for the trimmed query', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ results: [] }));

      await searchLocations('  Berlin  ');

      expect(requestedUrl(fetchMock).searchParams.get('name')).toBe('Berlin');
    });

    it('maps every result to the location shape', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          results: [
            {
              name: 'Berlin',
              country: 'Germany',
              admin1: 'Berlin',
              latitude: 52.5170365,
              longitude: 13.3888599,
            },
            {
              name: 'Berlin',
              country: 'United States',
              admin1: 'New Hampshire',
              latitude: 44.46867,
              longitude: -71.18509,
            },
          ],
        }),
      );

      const locations = await searchLocations('Berlin');

      expect(locations).toEqual([
        {
          name: 'Berlin',
          country: 'Germany',
          admin1: 'Berlin',
          lat: 52.5170365,
          lon: 13.3888599,
        },
        {
          name: 'Berlin',
          country: 'United States',
          admin1: 'New Hampshire',
          lat: 44.46867,
          lon: -71.18509,
        },
      ]);
    });

    it('returns an empty array when the response holds no results', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      await expect(searchLocations('Berlin')).resolves.toEqual([]);

      fetchMock.mockResolvedValue(jsonResponse({ results: null }));
      await expect(searchLocations('Berlin')).resolves.toEqual([]);
    });

    it('returns an empty array when the API finds no match', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ results: [] }));

      await expect(searchLocations('zzzzzz')).resolves.toEqual([]);
    });

    it('falls back to empty strings and nulls when fields are missing', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ results: [{ name: 'Berlin', country: 'Germany' }] }),
      );

      await expect(searchLocations('Berlin')).resolves.toEqual([
        { name: 'Berlin', country: 'Germany', admin1: '', lat: null, lon: null },
      ]);
    });

    it('rejects when the API answers with an error status', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));

      await expect(searchLocations('Berlin')).rejects.toThrow(/500/);
    });

    it('rejects when the network request fails', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(searchLocations('Berlin')).rejects.toThrow('Failed to fetch');
    });

    it('rejects when the body is not valid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      });

      await expect(searchLocations('Berlin')).rejects.toThrow(SyntaxError);
    });

    it('forwards an abort signal to the request', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ results: [] }));
      const controller = new AbortController();

      await searchLocations('Berlin', { signal: controller.signal });

      expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
    });
  });

  describe('fetchForecast(lat, lon, units)', () => {
    const coords = { lat: 52.5170365, lon: 13.3888599 };

    const payload = {
      current: {
        time: '2026-10-27T12:00',
        temperature_2m: 14.3,
        apparent_temperature: 13.1,
        relative_humidity_2m: 61,
        precipitation: 0.2,
        weather_code: 3,
        wind_speed_10m: 11.5,
      },
      daily: {
        time: ['2026-10-27', '2026-10-28'],
        temperature_2m_max: [16.1, 17.4],
        temperature_2m_min: [8.2, 9.6],
        weather_code: [3, 61],
      },
      hourly: {
        time: ['2026-10-27T12:00', '2026-10-27T13:00'],
        temperature_2m: [14.3, 14.8],
        weather_code: [3, 3],
      },
    };

    it('requests the forecast endpoint with coordinates, timezone and horizon', async () => {
      fetchMock.mockResolvedValue(jsonResponse(payload));

      await fetchForecast(coords.lat, coords.lon, 'metric');

      const url = requestedUrl(fetchMock);
      expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
      expect(url.searchParams.get('latitude')).toBe('52.5170365');
      expect(url.searchParams.get('longitude')).toBe('13.3888599');
      expect(url.searchParams.get('timezone')).toBe('auto');
      expect(url.searchParams.get('forecast_days')).toBe('7');
    });

    it('asks for the current, hourly and daily fields', async () => {
      fetchMock.mockResolvedValue(jsonResponse(payload));

      await fetchForecast(coords.lat, coords.lon, 'metric');

      const url = requestedUrl(fetchMock);
      expect(url.searchParams.get('current').split(',')).toEqual(
        expect.arrayContaining([
          'temperature_2m',
          'relative_humidity_2m',
          'apparent_temperature',
          'precipitation',
          'weather_code',
          'wind_speed_10m',
        ]),
      );
      expect(url.searchParams.get('hourly').split(',')).toEqual(
        expect.arrayContaining(['temperature_2m', 'weather_code']),
      );
      expect(url.searchParams.get('daily').split(',')).toEqual(
        expect.arrayContaining([
          'weather_code',
          'temperature_2m_max',
          'temperature_2m_min',
        ]),
      );
    });

    it('sends the unit parameters of the requested unit system', async () => {
      fetchMock.mockResolvedValue(jsonResponse(payload));

      await fetchForecast(coords.lat, coords.lon, 'metric');
      await fetchForecast(coords.lat, coords.lon, 'imperial');

      const metricUrl = requestedUrl(fetchMock, 0);
      const imperialUrl = requestedUrl(fetchMock, 1);
      for (const [key, value] of Object.entries(UNITS.metric.apiParams)) {
        expect(metricUrl.searchParams.get(key)).toBe(value);
      }
      for (const [key, value] of Object.entries(UNITS.imperial.apiParams)) {
        expect(imperialUrl.searchParams.get(key)).toBe(value);
      }
      expect(imperialUrl.searchParams.get('temperature_unit')).toBe('fahrenheit');
    });

    it('parses the current conditions', async () => {
      fetchMock.mockResolvedValue(jsonResponse(payload));

      const forecast = await fetchForecast(coords.lat, coords.lon, 'metric');

      expect(forecast.current).toEqual({
        time: '2026-10-27T12:00',
        temperature: 14.3,
        apparent_temperature: 13.1,
        humidity: 61,
        precipitation: 0.2,
        weather_code: 3,
        wind_speed: 11.5,
      });
    });

    it('parses the daily forecast', async () => {
      fetchMock.mockResolvedValue(jsonResponse(payload));

      const forecast = await fetchForecast(coords.lat, coords.lon, 'metric');

      expect(forecast.daily).toEqual({
        time: ['2026-10-27', '2026-10-28'],
        temperature_2m_max: [16.1, 17.4],
        temperature_2m_min: [8.2, 9.6],
        weather_code: [3, 61],
      });
    });

    it('parses the hourly forecast', async () => {
      fetchMock.mockResolvedValue(jsonResponse(payload));

      const forecast = await fetchForecast(coords.lat, coords.lon, 'metric');

      expect(forecast.hourly).toEqual({
        time: ['2026-10-27T12:00', '2026-10-27T13:00'],
        temperature_2m: [14.3, 14.8],
        weather_code: [3, 3],
      });
    });

    it('returns empty arrays when the response omits the daily and hourly blocks', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ current: payload.current }));

      const forecast = await fetchForecast(coords.lat, coords.lon, 'metric');

      expect(forecast.daily).toEqual({
        time: [],
        temperature_2m_max: [],
        temperature_2m_min: [],
        weather_code: [],
      });
      expect(forecast.hourly).toEqual({
        time: [],
        temperature_2m: [],
        weather_code: [],
      });
    });

    it('falls back to nulls when a current value is missing', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ current: { time: '2026-10-27T12:00' } }));

      const forecast = await fetchForecast(coords.lat, coords.lon, 'metric');

      expect(forecast.current.temperature).toBeNull();
      expect(forecast.current.humidity).toBeNull();
      expect(forecast.current.weather_code).toBeNull();
      expect(Number.isNaN(forecast.current.wind_speed)).toBe(false);
    });

    it('keeps hourly arrays aligned when a value is missing', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          hourly: {
            time: ['2026-10-27T12:00', '2026-10-27T13:00'],
            temperature_2m: [14.3, null],
            weather_code: [3],
          },
        }),
      );

      const forecast = await fetchForecast(coords.lat, coords.lon, 'metric');

      expect(forecast.hourly.time).toHaveLength(2);
      expect(forecast.hourly.temperature_2m).toEqual([14.3, null]);
      expect(forecast.hourly.weather_code).toEqual([3, null]);
    });

    it('rejects when the API answers with an error status', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 400 }));

      await expect(fetchForecast(coords.lat, coords.lon, 'metric')).rejects.toThrow(/400/);
    });

    it('rejects when the network request fails', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(
        fetchForecast(coords.lat, coords.lon, 'metric'),
      ).rejects.toThrow('Failed to fetch');
    });

    it('rejects when the body is empty', async () => {
      fetchMock.mockResolvedValue(jsonResponse(null));

      await expect(fetchForecast(coords.lat, coords.lon, 'metric')).rejects.toThrow(
        /empty/i,
      );
    });

    it('rejects without touching the network when the coordinates are invalid', async () => {
      await expect(fetchForecast('north', undefined, 'metric')).rejects.toThrow(
        /coordinates/i,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('forwards an abort signal to the request', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      const controller = new AbortController();

      await fetchForecast(52.5170365, 13.3888599, 'metric', {
        signal: controller.signal,
      });

      expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
    });
  });

  describe('fetchByCoords(lat, lon, units)', () => {
    it('is an alias of fetchForecast', () => {
      expect(typeof fetchByCoords).toBe('function');
      expect(fetchByCoords).toBe(fetchForecast);
    });

    it('performs the same request and returns the same shape', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          current: { temperature_2m: 14.3 },
          daily: { time: ['2026-10-27'] },
          hourly: { time: ['2026-10-27T12:00'] },
        }),
      );

      const forecast = await fetchByCoords(52.5170365, 13.3888599, 'metric');

      expect(requestedUrl(fetchMock).searchParams.get('latitude')).toBe('52.5170365');
      expect(forecast.current.temperature).toBe(14.3);
      expect(forecast.daily.time).toEqual(['2026-10-27']);
    });
  });
});
