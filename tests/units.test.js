import { describe, expect, it } from 'vitest';
import * as unitsModule from '../js/units.js';

const { UNITS, getUnitConfig, toggleUnits } = unitsModule;

describe('js/units.js', () => {
  describe('UNITS', () => {
    it('exposes exactly the metric and imperial unit systems', () => {
      expect(Object.keys(UNITS)).toEqual(['metric', 'imperial']);
    });

    it('labels the metric system in °C, km/h and mm', () => {
      expect(UNITS.metric.units).toEqual({
        temperature: '°C',
        wind: 'km/h',
        precipitation: 'mm',
      });
    });

    it('labels the imperial system in °F, mph and in', () => {
      expect(UNITS.imperial.units).toEqual({
        temperature: '°F',
        wind: 'mph',
        precipitation: 'in',
      });
    });

    it('maps the metric system to the Open-Meteo query parameters', () => {
      expect(UNITS.metric.apiParams).toEqual({
        temperature_unit: 'celsius',
        wind_speed_unit: 'kmh',
        precipitation_unit: 'mm',
      });
    });

    it('maps the imperial system to the Open-Meteo query parameters', () => {
      expect(UNITS.imperial.apiParams).toEqual({
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        precipitation_unit: 'inch',
      });
    });

    it('names the unit systems for the dropdown', () => {
      expect(UNITS.metric.label).toBe('Metric');
      expect(UNITS.imperial.label).toBe('Imperial');
    });

    it('is frozen so no consumer can corrupt the table', () => {
      expect(Object.isFrozen(UNITS)).toBe(true);
      expect(Object.isFrozen(UNITS.metric)).toBe(true);
      expect(Object.isFrozen(UNITS.metric.units)).toBe(true);
      expect(Object.isFrozen(UNITS.metric.apiParams)).toBe(true);
    });
  });

  describe('getUnitConfig(key)', () => {
    it('returns the metric configuration for the "metric" key', () => {
      expect(getUnitConfig('metric')).toBe(UNITS.metric);
    });

    it('returns the imperial configuration for the "imperial" key', () => {
      expect(getUnitConfig('imperial')).toBe(UNITS.imperial);
    });

    it('falls back to metric for an unknown key', () => {
      expect(getUnitConfig('kelvin')).toBe(UNITS.metric);
      expect(getUnitConfig('')).toBe(UNITS.metric);
      expect(getUnitConfig(undefined)).toBe(UNITS.metric);
      expect(getUnitConfig(null)).toBe(UNITS.metric);
    });

    it('does not resolve inherited object properties', () => {
      expect(getUnitConfig('constructor')).toBe(UNITS.metric);
      expect(getUnitConfig('toString')).toBe(UNITS.metric);
    });
  });

  describe('toggleUnits(current)', () => {
    it('switches metric to imperial', () => {
      expect(toggleUnits('metric')).toBe('imperial');
    });

    it('switches imperial to metric', () => {
      expect(toggleUnits('imperial')).toBe('metric');
    });

    it('accepts a unit configuration object', () => {
      expect(toggleUnits(UNITS.metric)).toBe('imperial');
      expect(toggleUnits(UNITS.imperial)).toBe('metric');
    });

    it('toggles from the metric fallback for an unknown key', () => {
      expect(toggleUnits('kelvin')).toBe('imperial');
      expect(toggleUnits(undefined)).toBe('imperial');
    });
  });
});
