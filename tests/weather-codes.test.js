import { describe, expect, it } from 'vitest';
import * as weatherCodesModule from '../js/weather-codes.js';

const { weatherCodes, getWeatherInfo } = weatherCodesModule;

// The icons that actually ship in assets/images — resolved the same way the
// app will resolve them at build time.
const AVAILABLE_ICONS = new Set(
  Object.keys(
    import.meta.glob('../assets/images/*.webp', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map((path) => path.split('/').pop()),
);

// The eight icon categories the WMO codes are grouped into.
const GROUPS = {
  sunny: [0, 1],
  'partly-cloudy': [2],
  overcast: [3],
  fog: [45, 48],
  drizzle: [51, 53, 55, 56, 57],
  rain: [61, 63, 65, 66, 67, 80, 81, 82],
  snow: [71, 73, 75, 77, 85, 86],
  storm: [95, 96, 99],
};

const CATEGORY_ICONS = {
  sunny: 'icon-sunny.webp',
  'partly-cloudy': 'icon-partly-cloudy.webp',
  overcast: 'icon-overcast.webp',
  fog: 'icon-fog.webp',
  drizzle: 'icon-drizzle.webp',
  rain: 'icon-rain.webp',
  snow: 'icon-snow.webp',
  storm: 'icon-storm.webp',
};

describe('js/weather-codes.js', () => {
  describe('getWeatherInfo(code)', () => {
    it('maps WMO code 0 (clear sky) to the sunny icon', () => {
      expect(getWeatherInfo(0)).toEqual({
        description: 'Clear sky',
        icon: 'icon-sunny.webp',
      });
    });

    it('maps WMO code 1 (mainly clear) to the sunny icon', () => {
      expect(getWeatherInfo(1)).toEqual({
        description: 'Mainly clear',
        icon: 'icon-sunny.webp',
      });
    });

    it('maps WMO code 3 (overcast) to the overcast icon', () => {
      expect(getWeatherInfo(3)).toEqual({
        description: 'Overcast',
        icon: 'icon-overcast.webp',
      });
    });

    it('maps WMO code 99 (thunderstorm) to the storm icon', () => {
      expect(getWeatherInfo(99)).toEqual({
        description: 'Thunderstorm',
        icon: 'icon-storm.webp',
      });
    });

    it('falls back to Unknown for a code that is not in the table', () => {
      expect(getWeatherInfo(999)).toEqual({
        description: 'Unknown',
        icon: 'icon-overcast.webp',
      });
    });

    it('falls back for missing or malformed codes', () => {
      const fallback = { description: 'Unknown', icon: 'icon-overcast.webp' };

      expect(getWeatherInfo(undefined)).toEqual(fallback);
      expect(getWeatherInfo(null)).toEqual(fallback);
      expect(getWeatherInfo(NaN)).toEqual(fallback);
      expect(getWeatherInfo(-1)).toEqual(fallback);
      expect(getWeatherInfo('')).toEqual(fallback);
      expect(getWeatherInfo('not-a-code')).toEqual(fallback);
    });

    it('does not resolve inherited object properties', () => {
      expect(getWeatherInfo('constructor')).toEqual({
        description: 'Unknown',
        icon: 'icon-overcast.webp',
      });
    });

    it('accepts a numeric string code', () => {
      expect(getWeatherInfo('3')).toEqual({
        description: 'Overcast',
        icon: 'icon-overcast.webp',
      });
    });

    it('returns a fresh object so callers cannot corrupt the table', () => {
      const first = getWeatherInfo(0);
      first.description = 'Hacked';

      expect(getWeatherInfo(0)).toEqual({
        description: 'Clear sky',
        icon: 'icon-sunny.webp',
      });
    });
  });

  describe('weatherCodes', () => {
    it('exposes exactly the 28 WMO codes of the table', () => {
      const expectedCodes = Object.values(GROUPS).flat().sort((a, b) => a - b);

      expect(Object.keys(weatherCodes).map(Number).sort((a, b) => a - b)).toEqual(
        expectedCodes,
      );
    });

    it('groups the WMO codes into the eight icon categories', () => {
      for (const [category, codes] of Object.entries(GROUPS)) {
        for (const code of codes) {
          expect(weatherCodes[code]).toEqual({
            description: expect.any(String),
            icon: CATEGORY_ICONS[category],
          });
        }
      }
    });

    it('gives every code a non-empty description', () => {
      for (const code of Object.keys(weatherCodes)) {
        expect(weatherCodes[code].description.length).toBeGreaterThan(0);
      }
    });

    it('only references icon assets that exist in assets/images', () => {
      for (const code of Object.keys(weatherCodes)) {
        const { icon } = weatherCodes[code];
        expect(AVAILABLE_ICONS.has(icon)).toBe(true);
      }
    });
  });
});
