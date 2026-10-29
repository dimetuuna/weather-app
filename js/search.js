/**
 * search.js — location search with autocomplete.
 *
 * Single responsibility: wire the search input to the geocoding API and
 * turn the results into a keyboard-accessible suggestion list. It knows
 * nothing about the network beyond calling `searchLocations`, and nothing
 * about state beyond calling the callbacks it is given.
 */

import { searchLocations } from './api.js';

const DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 5;

/**
 * Wires up autocomplete behaviour on a search root.
 *
 * @param {HTMLElement} root The element containing `.search__input`,
 *   `.search__submit` and `.search__suggestions`.
 * @param {object} options
 * @param {(results: Array) => void} [options.onResults] Called with the raw
 *   geocoding results (already capped).
 * @param {(location: object) => void} [options.onSelect] Called when the
 *   user picks a suggestion.
 * @returns {{ destroy: () => void }} Cleanup handle.
 */
export function initSearch(root, options = {}) {
  const input = root.querySelector('.search__input');
  const submit = root.querySelector('.search__submit');
  const list = root.querySelector('.search__suggestions');

  if (!input || !list) {
    return { destroy() {} };
  }

  const { onResults, onSelect } = options;

  let debounceTimer = null;
  let activeIndex = -1;
  let currentResults = [];
  let abortController = null;
  let lastSelectedCity = '';
  let lastSelectedLabel = '';

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  if (list.id) {
    input.setAttribute('aria-controls', list.id);
  } else {
    list.id = 'search-suggestions';
    input.setAttribute('aria-controls', list.id);
  }

  function clearSuggestions() {
    currentResults = [];
    activeIndex = -1;
    list.replaceChildren();
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function renderSuggestions(results) {
    currentResults = results.slice(0, MAX_SUGGESTIONS);
    list.replaceChildren();
    if (currentResults.length === 0) {
      clearSuggestions();
      return;
    }
    for (const result of currentResults) {
      const item = document.createElement('li');
      item.className = 'search__suggestion';
      item.setAttribute('role', 'option');
      const name = document.createElement('span');
      name.className = 'search__suggestion-name';
      name.textContent = result.name;
      const meta = document.createElement('span');
      meta.className = 'search__suggestion-meta';
      const parts = [result.admin1, result.country].filter(Boolean);
      meta.textContent = parts.length ? ` ${parts.join(', ')}` : '';
      item.append(name, meta);
      // Prevent the input from blurring before the click registers (important
      // on touch devices and some browsers where blur cancels the click).
      item.setAttribute('aria-selected', 'false');
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
      });
      item.addEventListener('click', () => selectResult(result));
      list.append(item);
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (typeof onResults === 'function') {
      onResults(currentResults);
    }
  }

  function selectResult(result) {
    clearSuggestions();
    const parts = [result.admin1, result.country].filter(Boolean);
    const label = parts.length
      ? `${result.name} ${parts.join(', ')}`
      : result.name;
    input.value = label;
    lastSelectedCity = result.name;
    lastSelectedLabel = label;
    input.blur();
    if (typeof onSelect === 'function') {
      onSelect(result);
    }
    document.dispatchEvent(
      new CustomEvent('location:select', { detail: { location: result } }),
    );
  }

  function setActive(index) {
    const items = [...list.querySelectorAll('.search__suggestion')];
    if (items.length === 0) {
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
      return;
    }
    activeIndex = Math.max(-1, Math.min(index, items.length - 1));
    items.forEach((item, i) => {
      item.classList.toggle('is-active', i === activeIndex);
      item.setAttribute('aria-selected', String(i === activeIndex));
      if (i === activeIndex) {
        item.id = item.id || `search-suggestion-${i}`;
        input.setAttribute('aria-activedescendant', item.id);
      }
    });
    if (activeIndex === -1) {
      input.removeAttribute('aria-activedescendant');
    }
  }

  async function runSearch(query) {
    // If the box still holds a previously selected full label, search by the
    // city name only so we don't send "A Coruña Galicia, Spain" to the API.
    let trimmed = query.trim();
    if (trimmed !== '' && trimmed === lastSelectedLabel && lastSelectedCity) {
      trimmed = lastSelectedCity;
    }
    if (trimmed === '') {
      clearSuggestions();
      return;
    }
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();
    try {
      const results = await searchLocations(trimmed, {
        signal: abortController.signal,
      });
      // Ignore stale results
      if (input.value.trim() !== trimmed) {
        return;
      }
      if (!results || results.length === 0) {
        clearSuggestions();
        document.dispatchEvent(new CustomEvent('search:empty'));
        return;
      }
      renderSuggestions(results);
    } catch (error) {
      if (error && error.name === 'AbortError') {
        return;
      }
      clearSuggestions();
      document.dispatchEvent(
        new CustomEvent('search:error', { detail: { message: String(error) } }),
      );
    }
  }

  function scheduleSearch() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      runSearch(input.value);
    }, DEBOUNCE_MS);
  }

  function onKeyDown(event) {
    const items = [...list.querySelectorAll('.search__suggestion')];
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (list.hidden) {
          scheduleSearch();
          return;
        }
        setActive(activeIndex + 1 >= items.length ? 0 : activeIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (list.hidden) {
          return;
        }
        setActive(activeIndex - 1 < 0 ? items.length - 1 : activeIndex - 1);
        break;
      case 'Enter':
        if (activeIndex >= 0 && currentResults[activeIndex]) {
          event.preventDefault();
          selectResult(currentResults[activeIndex]);
        } else if (input.value.trim() !== '') {
          // fall through to submit button
        }
        break;
      case 'Escape':
        clearSuggestions();
        input.blur();
        break;
      default:
        break;
    }
  }

  input.addEventListener('input', scheduleSearch);
  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('blur', () => {
    // Delay so click on suggestion registers
    setTimeout(clearSuggestions, 150);
  });

  const form = root.matches?.('[data-search-form]') ? root : (root.querySelector('[data-search-form]') || root.querySelector('form.search') || root.closest('form'));
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (activeIndex >= 0 && currentResults[activeIndex]) {
        selectResult(currentResults[activeIndex]);
      } else {
        runSearch(input.value);
      }
    });
  }

  if (submit) {
    submit.addEventListener('click', (event) => {
      event.preventDefault();
      if (activeIndex >= 0 && currentResults[activeIndex]) {
        selectResult(currentResults[activeIndex]);
      } else {
        runSearch(input.value);
      }
    });
  }

  function destroy() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (abortController) {
      abortController.abort();
    }
    input.removeEventListener('input', scheduleSearch);
    input.removeEventListener('keydown', onKeyDown);
  }

  return { destroy };
}