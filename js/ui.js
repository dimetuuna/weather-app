/**
 * ui.js — DOM rendering.
 *
 * Turns application state into DOM without interpreting untrusted strings as
 * markup. Forecast values are normalized by js/api.js; the small guards here
 * keep incomplete data from leaking `NaN` or `undefined` into the interface.
 */

import { persist } from './state.js';
import { getUnitConfig } from './units.js';
import { getWeatherInfo } from './weather-codes.js';

const IMAGE_PATH = '/assets/images/';
const PLACEHOLDER = '—';
const MAX_DAILY_ITEMS = 7;
const MAX_SUGGESTIONS = 5;

const STATUS_MESSAGES = {
  loading: 'Loading weather…',
  empty: 'No weather found. Try searching for another place.',
  error: 'We could not load the weather. Please try again.',
};

function query(root, selector) {
  return root && typeof root.querySelector === 'function'
    ? root.querySelector(selector)
    : null;
}

function setText(root, selector, value) {
  const element = query(root, selector);
  if (element) {
    element.textContent = value;
  }
  return element;
}

function createElement(document, tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function valueAt(values, index) {
  return values[index] ?? null;
}

function finiteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatNumber(value, { suffix = '', maximumFractionDigits = 1 } = {}) {
  const number = finiteNumber(value);
  if (number === null) {
    return PLACEHOLDER;
  }

  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(number);
  return suffix ? `${formatted}${suffix}` : formatted;
}

function formatTemperature(value) {
  const number = finiteNumber(value);
  return number === null ? PLACEHOLDER : `${Math.round(number)}°`;
}

function setTemperature(element, value, units) {
  if (!element) {
    return;
  }

  const number = finiteNumber(value);
  element.textContent = formatTemperature(number);
  if (number === null) {
    element.removeAttribute('aria-label');
    return;
  }

  const scale = units.key === 'imperial' ? 'Fahrenheit' : 'Celsius';
  element.setAttribute('aria-label', `${Math.round(number)} degrees ${scale}`);
}

function parseLocalDate(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour = '0', minute = '0'] = match;
  const parts = [year, month, day, hour, minute].map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]);

  if (
    date.getFullYear() !== parts[0]
    || date.getMonth() !== parts[1] - 1
    || date.getDate() !== parts[2]
    || date.getHours() !== parts[3]
    || date.getMinutes() !== parts[4]
  ) {
    return null;
  }

  return date;
}

function formatDate(value, options, fallback = PLACEHOLDER) {
  const date = parseLocalDate(value);
  return date ? new Intl.DateTimeFormat('en-US', options).format(date) : fallback;
}

function dateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : null;
}

function locationLabel(location, includeRegion = false) {
  if (!location || typeof location !== 'object') {
    return '';
  }

  const parts = includeRegion
    ? [location.name, location.admin1, location.country]
    : [location.name, location.country];
  const seen = new Set();

  return parts
    .filter((part) => typeof part === 'string' && part.trim() !== '')
    .map((part) => part.trim())
    .filter((part) => {
      if (seen.has(part)) {
        return false;
      }
      seen.add(part);
      return true;
    })
    .join(', ');
}

function createWeatherIcon(document, className, info) {
  const icon = createElement(document, 'img', className);
  icon.src = `${IMAGE_PATH}${info.icon}`;
  icon.alt = info.description;
  icon.width = 48;
  icon.height = 48;
  return icon;
}

/** Render the current conditions card. */
export function renderCurrent(state = {}, root = globalThis.document) {
  const current = state?.data?.current;
  const hasCurrent = current && typeof current === 'object';
  const source = hasCurrent ? current : {};
  const units = getUnitConfig(state?.units);
  const info = hasCurrent
    ? getWeatherInfo(source.weather_code)
    : { description: '', icon: 'icon-sunny.webp' };

  setText(
    root,
    '[data-current-location]',
    locationLabel(state?.location) || 'Current location',
  );
  setText(
    root,
    '[data-current-date]',
    hasCurrent
      ? formatDate(source.time, {
        weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
      })
      : PLACEHOLDER,
  );
  setTemperature(query(root, '[data-current-temperature]'), source.temperature, units);
  setText(root, '[data-current-description]', info.description);

  const icon = query(root, '[data-current-icon]');
  if (icon) {
    icon.src = `${IMAGE_PATH}${info.icon}`;
    icon.alt = '';
  }
}

/** Render feels-like temperature, humidity, wind and precipitation. */
export function renderMetrics(state = {}, root = globalThis.document) {
  const current = state?.data?.current ?? {};
  const units = getUnitConfig(state?.units);

  setTemperature(
    query(root, '[data-metric="feels-like"]'),
    current.apparent_temperature,
    units,
  );
  setText(
    root,
    '[data-metric="humidity"]',
    formatNumber(current.humidity, { suffix: '%', maximumFractionDigits: 0 }),
  );
  setText(
    root,
    '[data-metric="wind"]',
    finiteNumber(current.wind_speed) === null
      ? PLACEHOLDER
      : `${formatNumber(current.wind_speed)} ${units.units.wind}`,
  );
  setText(
    root,
    '[data-metric="precipitation"]',
    finiteNumber(current.precipitation) === null
      ? PLACEHOLDER
      : `${formatNumber(current.precipitation, {
        maximumFractionDigits: units.key === 'imperial' ? 2 : 1,
      })} ${units.units.precipitation}`,
  );
}

/** Render up to seven daily forecast cards. */
export function renderDaily(state = {}, root = globalThis.document) {
  const list = query(root, '[data-daily-list]');
  if (!list) {
    return;
  }

  const daily = state?.data?.daily ?? {};
  const times = asArray(daily.time);
  const highs = asArray(daily.temperature_2m_max);
  const lows = asArray(daily.temperature_2m_min);
  const codes = asArray(daily.weather_code);
  const count = Math.min(
    Math.max(times.length, highs.length, lows.length, codes.length),
    MAX_DAILY_ITEMS,
  );
  const units = getUnitConfig(state?.units);
  const document = list.ownerDocument;
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < count; index += 1) {
    const info = getWeatherInfo(valueAt(codes, index));
    const item = createElement(document, 'li', 'daily__item');
    const day = createElement(
      document,
      'span',
      'daily__day',
      formatDate(valueAt(times, index), { weekday: 'short' }, `Day ${index + 1}`),
    );
    const icon = createWeatherIcon(document, 'daily__icon', info);
    const temperatures = createElement(document, 'div', 'daily__temperatures');
    const high = createElement(document, 'span', 'daily__high');
    const low = createElement(document, 'span', 'daily__low');

    setTemperature(high, valueAt(highs, index), units);
    setTemperature(low, valueAt(lows, index), units);
    temperatures.append(high, low);
    item.append(day, icon, temperatures);
    fragment.append(item);
  }

  list.replaceChildren(fragment);
}

function forecastDays(daily, hourly) {
  const dailyDays = asArray(daily.time)
    .slice(0, MAX_DAILY_ITEMS)
    .map(dateKey)
    .filter(Boolean);

  if (dailyDays.length > 0) {
    return dailyDays;
  }

  return [...new Set(asArray(hourly.time).map(dateKey).filter(Boolean))]
    .slice(0, MAX_DAILY_ITEMS);
}

/** Render the day selector and hourly rows for the selected day. */
export function renderHourly(state = {}, root = globalThis.document) {
  const select = query(root, '[data-hourly-day]');
  const list = query(root, '[data-hourly-list]');
  const daily = state?.data?.daily ?? {};
  const hourly = state?.data?.hourly ?? {};
  const days = forecastDays(daily, hourly);
  const requestedIndex = Number.isInteger(state?.selectedDayIndex)
    ? state.selectedDayIndex
    : 0;
  const selectedIndex = Math.min(Math.max(requestedIndex, 0), Math.max(days.length - 1, 0));

  if (select) {
    const fragment = select.ownerDocument.createDocumentFragment();
    days.forEach((day, index) => {
      const option = createElement(
        select.ownerDocument,
        'option',
        '',
        formatDate(day, { weekday: 'long' }, `Day ${index + 1}`),
      );
      option.value = String(index);
      fragment.append(option);
    });
    select.replaceChildren(fragment);
    select.disabled = days.length === 0;
    select.value = days.length > 0 ? String(selectedIndex) : '';
  }

  if (!list) {
    return;
  }

  const times = asArray(hourly.time);
  const temperatures = asArray(hourly.temperature_2m);
  const codes = asArray(hourly.weather_code);
  const selectedDay = days[selectedIndex];
  const units = getUnitConfig(state?.units);
  const document = list.ownerDocument;
  const fragment = document.createDocumentFragment();

  times.forEach((time, index) => {
    if (!selectedDay || dateKey(time) !== selectedDay) {
      return;
    }

    const info = getWeatherInfo(valueAt(codes, index));
    const item = createElement(document, 'li', 'hourly__item');
    const icon = createWeatherIcon(document, 'hourly__icon', info);
    const hour = createElement(
      document,
      'span',
      'hourly__time',
      formatDate(time, { hour: 'numeric' }),
    );
    const temperature = createElement(document, 'span', 'hourly__temperature');

    setTemperature(temperature, valueAt(temperatures, index), units);
    item.append(icon, hour, temperature);
    fragment.append(item);
  });

  list.replaceChildren(fragment);
}

/** Render up to five autocomplete suggestions. */
export function renderSuggestions(suggestions = [], root = globalThis.document) {
  const list = query(root, '[data-search-suggestions]');
  if (!list) {
    return;
  }

  const locations = asArray(suggestions).slice(0, MAX_SUGGESTIONS);
  const document = list.ownerDocument;
  const fragment = document.createDocumentFragment();

  locations.forEach((location, index) => {
    const option = createElement(
      document,
      'li',
      'search__suggestion',
      locationLabel(location, true) || 'Unknown location',
    );
    option.id = `search-suggestion-${index}`;
    option.dataset.suggestionIndex = String(index);
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    fragment.append(option);
  });

  list.replaceChildren(fragment);
  list.hidden = locations.length === 0;

  const input = query(root, '[data-search-input]');
  if (input) {
    input.setAttribute('aria-expanded', String(locations.length > 0));
    if (locations.length === 0) {
      input.removeAttribute('aria-activedescendant');
    }
  }
}

/** Render loading, empty and error feedback; idle and success stay hidden. */
export function renderStatus(state = {}, root = globalThis.document) {
  const status = query(root, '[data-status]');
  if (!status) {
    return;
  }

  const statusName = typeof state?.status === 'string' ? state.status : 'idle';
  const hasCustomError = statusName === 'error'
    && typeof state?.error === 'string'
    && state.error.trim() !== '';
  const message = hasCustomError
    ? state.error
    : STATUS_MESSAGES[statusName] ?? '';

  status.dataset.status = statusName;
  status.textContent = message;
  status.hidden = message === '';
}

/**
 * Wires the units menu button to the application store.
 *
 * The six options represent three dimensions, but they share one unit-system
 * setting: choosing any metric option selects metric, and any imperial option
 * selects imperial. Changed selections are persisted and announced both through
 * `onChange` and a document-level `units:change` event so the app can refetch.
 */
export function initUnitsDropdown(
  root = globalThis.document,
  { getState, setState, onChange } = {},
) {
  const container = root?.matches?.('[data-units]')
    ? root
    : query(root, '[data-units]');
  const toggle = query(container, '[data-units-toggle]');
  const menu = query(container, '#units-menu');

  if (!container || !toggle || !menu) {
    return null;
  }
  if (typeof getState !== 'function' || typeof setState !== 'function') {
    throw new TypeError('initUnitsDropdown requires getState and setState functions.');
  }

  const document = container.ownerDocument;
  const options = [...menu.querySelectorAll('[data-units-option]')];

  function syncUnits() {
    const units = getUnitConfig(getState()?.units).key;
    options.forEach((option) => {
      option.setAttribute(
        'aria-checked',
        String(option.dataset.unitsOption === units),
      );
    });
    return units;
  }

  function focusOption(option) {
    if (!option) {
      return;
    }
    options.forEach((item) => {
      item.tabIndex = item === option ? 0 : -1;
    });
    option.focus({ preventScroll: true });
  }

  function closeUnitsDropdown({ restoreFocus = false } = {}) {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      toggle.focus({ preventScroll: true });
    }
  }

  function openUnitsDropdown(position = 'selected') {
    const units = syncUnits();
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');

    const selected = options.find((option) => option.dataset.unitsOption === units);
    const target = position === 'first'
      ? options[0]
      : position === 'last'
        ? options.at(-1)
        : selected ?? options[0];
    focusOption(target);
  }

  function toggleUnitsDropdown() {
    if (menu.hidden) {
      openUnitsDropdown();
    } else {
      closeUnitsDropdown({ restoreFocus: true });
    }
  }

  function selectOption(option) {
    const units = option?.dataset.unitsOption;
    if (units !== 'metric' && units !== 'imperial') {
      return;
    }

    const previousState = getState();
    if (getUnitConfig(previousState?.units).key !== units) {
      const nextState = setState({ units }) ?? getState();
      syncUnits();
      persist(nextState);
      if (typeof onChange === 'function') {
        onChange(nextState, previousState);
      }

      const CustomEventConstructor = document.defaultView?.CustomEvent
        ?? globalThis.CustomEvent;
      document.dispatchEvent(new CustomEventConstructor('units:change', {
        detail: { units },
      }));
    }

    closeUnitsDropdown({ restoreFocus: true });
  }

  function handleToggleKeydown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openUnitsDropdown(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  }

  function handleMenuClick(event) {
    const option = event.target.closest?.('[data-units-option]');
    if (option && menu.contains(option)) {
      selectOption(option);
    }
  }

  function handleMenuKeydown(event) {
    const option = event.target.closest?.('[data-units-option]');
    if (!option || !menu.contains(option)) {
      return;
    }

    const index = options.indexOf(option);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusOption(options[(index + 1) % options.length]);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusOption(options[(index - 1 + options.length) % options.length]);
        break;
      case 'Home':
        event.preventDefault();
        focusOption(options[0]);
        break;
      case 'End':
        event.preventDefault();
        focusOption(options.at(-1));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectOption(option);
        break;
      case 'Tab':
        closeUnitsDropdown();
        toggle.focus({ preventScroll: true });
        break;
      default:
        break;
    }
  }

  function handleDocumentClick(event) {
    if (!menu.hidden && !container.contains(event.target)) {
      closeUnitsDropdown();
    }
  }

  function handleDocumentKeydown(event) {
    if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault();
      closeUnitsDropdown({ restoreFocus: true });
    }
  }

  toggle.addEventListener('click', toggleUnitsDropdown);
  toggle.addEventListener('keydown', handleToggleKeydown);
  menu.addEventListener('click', handleMenuClick);
  menu.addEventListener('keydown', handleMenuKeydown);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleDocumentKeydown);

  const units = syncUnits();
  const selected = options.find((option) => option.dataset.unitsOption === units) ?? options[0];
  options.forEach((option) => {
    option.tabIndex = option === selected ? 0 : -1;
  });
  closeUnitsDropdown();

  return {
    open: openUnitsDropdown,
    close: closeUnitsDropdown,
    toggleUnitsDropdown,
    sync: syncUnits,
    destroy() {
      toggle.removeEventListener('click', toggleUnitsDropdown);
      toggle.removeEventListener('keydown', handleToggleKeydown);
      menu.removeEventListener('click', handleMenuClick);
      menu.removeEventListener('keydown', handleMenuKeydown);
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleDocumentKeydown);
    },
  };
}

/** Render every forecast region represented by the application state. */
export function renderApp(state = {}, root = globalThis.document) {
  renderStatus(state, root);
  renderCurrent(state, root);
  renderMetrics(state, root);
  renderDaily(state, root);
  renderHourly(state, root);

  if (Array.isArray(state?.suggestions)) {
    renderSuggestions(state.suggestions, root);
  }
}
