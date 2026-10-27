/**
 * weather-codes.js — WMO weather code mapping.
 *
 * Single responsibility: translate a WMO weather code into a human readable
 * description and the matching icon asset, with a safe fallback for unknown
 * codes.
 *
 * Open-Meteo reports the WMO 4677 code table. The 28 codes it can return are
 * grouped into the eight conditions that the eight icon assets in
 * `assets/images` represent.
 *
 * Implemented in the "weather code mapping" task.
 */

/**
 * The eight conditions the UI can show.
 *
 * `description` is the label rendered next to the condition, `icon` is the
 * file name of the matching asset in `assets/images`.
 */
const CONDITIONS = {
  sunny: { description: 'Clear sky', icon: 'icon-sunny.webp' },
  'partly-cloudy': { description: 'Partly cloudy', icon: 'icon-partly-cloudy.webp' },
  overcast: { description: 'Overcast', icon: 'icon-overcast.webp' },
  fog: { description: 'Fog', icon: 'icon-fog.webp' },
  drizzle: { description: 'Drizzle', icon: 'icon-drizzle.webp' },
  rain: { description: 'Rain', icon: 'icon-rain.webp' },
  snow: { description: 'Snow', icon: 'icon-snow.webp' },
  storm: { description: 'Thunderstorm', icon: 'icon-storm.webp' },
};

/**
 * WMO code -> condition.
 *
 * 0–3 sky cover · 45–48 fog · 51–57 drizzle · 61–67 rain · 71–77 snow ·
 * 80–82 rain showers · 85–86 snow showers · 95–99 thunderstorm.
 */
const CODE_CONDITIONS = {
  0: 'sunny',
  1: 'sunny',
  2: 'partly-cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'fog',
  51: 'drizzle',
  53: 'drizzle',
  55: 'drizzle',
  56: 'drizzle',
  57: 'drizzle',
  61: 'rain',
  63: 'rain',
  65: 'rain',
  66: 'rain',
  67: 'rain',
  71: 'snow',
  73: 'snow',
  75: 'snow',
  77: 'snow',
  80: 'rain',
  81: 'rain',
  82: 'rain',
  85: 'snow',
  86: 'snow',
  95: 'storm',
  96: 'storm',
  99: 'storm',
};

/**
 * Codes that share a condition but deserve their own, more precise label.
 * Everything else inherits the label of its condition.
 */
const CODE_LABELS = {
  1: 'Mainly clear',
};

/** Shown when Open-Meteo reports a code this table does not know. */
const FALLBACK = { description: 'Unknown', icon: 'icon-overcast.webp' };

/**
 * Every WMO code mapped to its description and icon, ready to be rendered.
 *
 * Frozen, so no consumer can corrupt the lookup table.
 */
export const weatherCodes = Object.freeze(
  Object.fromEntries(
    Object.entries(CODE_CONDITIONS).map(([code, condition]) => {
      const { description, icon } = CONDITIONS[condition];
      const label = Object.hasOwn(CODE_LABELS, code) ? CODE_LABELS[code] : description;

      return [code, Object.freeze({ description: label, icon })];
    }),
  ),
);

/**
 * Describe a WMO weather code.
 *
 * Unknown, missing or malformed codes resolve to the fallback instead of
 * throwing, so a surprising API response can never break the render.
 *
 * @param {number|string} code WMO code reported by Open-Meteo.
 * @returns {{ description: string, icon: string }} Label and icon file name.
 */
export function getWeatherInfo(code) {
  const entry = Object.hasOwn(weatherCodes, code) ? weatherCodes[code] : null;

  if (!entry) {
    return { ...FALLBACK };
  }

  return { description: entry.description, icon: entry.icon };
}
