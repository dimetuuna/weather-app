/**
 * units.js — measurement unit configuration.
 *
 * Single responsibility: describe the metric and imperial unit systems
 * (display labels + Open-Meteo query parameters) and provide helpers to read
 * and toggle them.
 *
 * The app never converts values client-side: Open-Meteo is asked for the
 * desired unit system and the numbers it returns are rendered as they come.
 *
 * Implemented in the "units definitions" task.
 */

/**
 * The two unit systems the app supports.
 *
 * `label` is the name shown in the units dropdown, `units` holds the short
 * symbols rendered next to a value (e.g. `23°` + `°C`) and `apiParams` holds
 * the Open-Meteo query parameters that make the endpoint answer in this unit
 * system.
 *
 * Frozen, so no consumer can corrupt the table.
 */
export const UNITS = Object.freeze({
  metric: Object.freeze({
    key: 'metric',
    label: 'Metric',
    units: Object.freeze({
      temperature: '°C',
      wind: 'km/h',
      precipitation: 'mm',
    }),
    apiParams: Object.freeze({
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
      precipitation_unit: 'mm',
    }),
  }),
  imperial: Object.freeze({
    key: 'imperial',
    label: 'Imperial',
    units: Object.freeze({
      temperature: '°F',
      wind: 'mph',
      precipitation: 'in',
    }),
    apiParams: Object.freeze({
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
    }),
  }),
});

/**
 * Read the configuration of a unit system.
 *
 * Unknown, missing or malformed keys resolve to the metric configuration
 * instead of throwing, so a corrupted value in `localStorage` can never break
 * the render.
 *
 * @param {string} key Unit system key — `'metric'` or `'imperial'`.
 * @returns {object} The matching unit configuration.
 */
export function getUnitConfig(key) {
  return Object.hasOwn(UNITS, key) ? UNITS[key] : UNITS.metric;
}

/**
 * Switch to the other unit system.
 *
 * Accepts a unit system key or a unit configuration object and answers with
 * the key of the other unit system, which is what the application state
 * stores and what `getUnitConfig` resolves.
 *
 * @param {string|object} current Current unit system key or configuration.
 * @returns {string} The key of the other unit system.
 */
export function toggleUnits(current) {
  const key = typeof current === 'object' && current !== null ? current.key : current;
  const config = getUnitConfig(key);

  return config.key === 'metric' ? 'imperial' : 'metric';
}
