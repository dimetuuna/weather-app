import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from '../js/state.js';
import { initUnitsDropdown } from '../js/ui.js';

const OPTION_LABELS = [
  'Celsius (°C)',
  'Fahrenheit (°F)',
  'km/h',
  'mph',
  'Millimeters (mm)',
  'Inches (in)',
];

function renderUnitsDropdown() {
  document.body.innerHTML = `
    <div class="units" data-units>
      <button
        class="units__toggle"
        type="button"
        id="units-toggle"
        data-units-toggle
        aria-haspopup="menu"
        aria-expanded="false"
        aria-controls="units-menu"
      >Units</button>
      <div class="units__menu" id="units-menu" role="menu" aria-label="Measurement units" hidden>
        <div class="units__group" role="group" aria-labelledby="units-temperature-label">
          <span class="units__group-label" id="units-temperature-label">Temperature</span>
          <button class="units__option" type="button" role="menuitemradio" aria-checked="true" data-units-option="metric">Celsius (°C)</button>
          <button class="units__option" type="button" role="menuitemradio" aria-checked="false" data-units-option="imperial">Fahrenheit (°F)</button>
        </div>
        <div class="units__group" role="group" aria-labelledby="units-wind-label">
          <span class="units__group-label" id="units-wind-label">Wind Speed</span>
          <button class="units__option" type="button" role="menuitemradio" aria-checked="true" data-units-option="metric">km/h</button>
          <button class="units__option" type="button" role="menuitemradio" aria-checked="false" data-units-option="imperial">mph</button>
        </div>
        <div class="units__group" role="group" aria-labelledby="units-precipitation-label">
          <span class="units__group-label" id="units-precipitation-label">Precipitation</span>
          <button class="units__option" type="button" role="menuitemradio" aria-checked="true" data-units-option="metric">Millimeters (mm)</button>
          <button class="units__option" type="button" role="menuitemradio" aria-checked="false" data-units-option="imperial">Inches (in)</button>
        </div>
      </div>
    </div>
    <button type="button" data-outside>Outside</button>
  `;
}

function getOption(label) {
  return [...document.querySelectorAll('[data-units-option]')]
    .find((option) => option.textContent === label);
}

function keydown(element, key) {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('initUnitsDropdown()', () => {
  let controller;
  let store;
  let onChange;
  let events;
  let onUnitsChange;

  beforeEach(() => {
    renderUnitsDropdown();
    localStorage.clear();
    store = createStore();
    onChange = vi.fn();
    events = [];
    onUnitsChange = (event) => events.push(event.detail);
    document.addEventListener('units:change', onUnitsChange);
    controller = initUnitsDropdown(document, {
      getState: store.getState,
      setState: store.setState,
      onChange,
    });
  });

  afterEach(() => {
    controller?.destroy();
    document.removeEventListener('units:change', onUnitsChange);
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('exposes a labelled menu with the current system checked in every group', () => {
    const toggle = document.querySelector('[data-units-toggle]');
    const menu = document.querySelector('#units-menu');
    const options = [...document.querySelectorAll('[role="menuitemradio"]')];

    expect(toggle.getAttribute('aria-haspopup')).toBe('menu');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(menu.hidden).toBe(true);
    expect(options.map((option) => option.textContent)).toEqual(OPTION_LABELS);
    expect(options.map((option) => option.getAttribute('aria-checked'))).toEqual([
      'true', 'false', 'true', 'false', 'true', 'false',
    ]);
    expect([...document.querySelectorAll('.units__group-label')].map((label) => label.textContent))
      .toEqual(['Temperature', 'Wind Speed', 'Precipitation']);
  });

  it('opens to the active option and closes on toggle, outside click, and Escape', () => {
    const toggle = document.querySelector('[data-units-toggle]');
    const menu = document.querySelector('#units-menu');

    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(menu.hidden).toBe(false);
    expect(document.activeElement).toBe(getOption('Celsius (°C)'));

    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(menu.hidden).toBe(true);

    controller.open();
    document.querySelector('[data-outside]').click();
    expect(menu.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    controller.open();
    keydown(getOption('Celsius (°C)'), 'Escape');
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
  });

  it('moves through options with wrapping arrows, Home, and End', () => {
    const toggle = document.querySelector('[data-units-toggle]');

    keydown(toggle, 'ArrowDown');
    expect(document.activeElement).toBe(getOption('Celsius (°C)'));

    keydown(document.activeElement, 'ArrowDown');
    expect(document.activeElement).toBe(getOption('Fahrenheit (°F)'));

    keydown(document.activeElement, 'End');
    expect(document.activeElement).toBe(getOption('Inches (in)'));

    keydown(document.activeElement, 'ArrowDown');
    expect(document.activeElement).toBe(getOption('Celsius (°C)'));

    keydown(document.activeElement, 'ArrowUp');
    expect(document.activeElement).toBe(getOption('Inches (in)'));

    keydown(document.activeElement, 'Home');
    expect(document.activeElement).toBe(getOption('Celsius (°C)'));
  });

  it('selects the whole imperial system with Enter, persists it, and announces one change', () => {
    const toggle = document.querySelector('[data-units-toggle]');
    toggle.click();
    keydown(getOption('Celsius (°C)'), 'ArrowDown');
    keydown(getOption('Fahrenheit (°F)'), 'Enter');

    expect(store.getState().units).toBe('imperial');
    expect(localStorage.getItem('units')).toBe('imperial');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].units).toBe('imperial');
    expect(events).toEqual([{ units: 'imperial' }]);
    expect([...document.querySelectorAll('[data-units-option]')]
      .map((option) => option.getAttribute('aria-checked')))
      .toEqual(['false', 'true', 'false', 'true', 'false', 'true']);
    expect(document.querySelector('#units-menu').hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
  });

  it('maps every metric and imperial option to its whole unit system', () => {
    controller.open();
    getOption('mph').click();
    expect(store.getState().units).toBe('imperial');

    controller.open();
    getOption('Millimeters (mm)').click();
    expect(store.getState().units).toBe('metric');

    controller.open();
    getOption('Inches (in)').click();
    expect(store.getState().units).toBe('imperial');

    controller.open();
    getOption('Celsius (°C)').click();
    expect(store.getState().units).toBe('metric');
  });

  it('closes an unchanged selection without refetching or emitting a duplicate change', () => {
    document.querySelector('[data-units-toggle]').click();
    getOption('km/h').click();

    expect(store.getState().units).toBe('metric');
    expect(onChange).not.toHaveBeenCalled();
    expect(events).toEqual([]);
    expect(document.querySelector('#units-menu').hidden).toBe(true);
  });

  it('supports Space selection and stops handling events after destroy', () => {
    const toggle = document.querySelector('[data-units-toggle]');
    toggle.click();
    keydown(getOption('Celsius (°C)'), 'End');
    keydown(getOption('Inches (in)'), ' ');

    expect(store.getState().units).toBe('imperial');
    controller.destroy();
    controller.open();
    keydown(getOption('Fahrenheit (°F)'), 'Escape');

    expect(document.querySelector('#units-menu').hidden).toBe(false);
  });
});
