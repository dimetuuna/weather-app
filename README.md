# Weather App — Frontend Mentor Challenge Solution

A responsive weather application built for the [Weather app challenge on Frontend Mentor](https://www.frontendmentor.io/challenges/weather-app-K1FhddVm49). It fetches live data from the free [Open-Meteo API](https://open-meteo.com/) (no API key required) and presents current conditions, a 7-day forecast and an hourly forecast, with imperial/metric unit switching, autocomplete search and browser geolocation.

## Table of contents

- [Overview](#overview)
  - [The challenge](#the-challenge)
  - [Links](#links)
- [My process](#my-process)
  - [Built with](#built-with)
  - [Architecture](#architecture)
  - [What I learned](#what-i-learned)
- [Author](#author)
- [Acknowledgments](#acknowledgments)

## Overview

### The challenge

Users should be able to:

- Search for weather information by entering a location in the search bar (autocomplete, up to 5 suggestions)
- View current weather conditions including temperature, weather icon and location details
- See additional weather metrics: "feels like" temperature, humidity, wind speed and precipitation
- Browse a 7-day forecast with daily high/low temperatures and weather icons
- View an hourly forecast and switch between days with a native `<select>`
- Toggle between Imperial and Metric units via an accessible units dropdown
- View an optimal layout for mobile (375px) and desktop (1440px)
- See hover and focus states for all interactive elements
- Get a best-effort local forecast automatically via browser geolocation (with an IP-based fallback)

### Links

- Solution URL: [GitHub repository](https://github.com/dimetuuna/weather-app)
- Live Site URL: [Vercel deployment](https://weather-app.vercel.app)

## My process

### Built with

- Semantic HTML5 markup
- CSS custom properties (design tokens) with a mobile-first workflow
- CSS Grid and Flexbox
- Vanilla JavaScript (ES modules) — no framework
- [Vite](https://vitejs.dev/) for dev server, HMR and production build
- [Vitest](https://vitest.dev/) + jsdom for unit tests
- [Open-Meteo API](https://open-meteo.com/) (geocoding + forecast, no API key)
- Self-hosted variable fonts (DM Sans, Bricolage Grotesque)
- WCAG 2.2-minded accessibility (keyboard, focus rings, ARIA, `prefers-reduced-motion`)

### Architecture

The app is split into small, single-responsibility modules under `js/`:

- `api.js` — Open-Meteo geocoding + forecast fetchers (pure parsing, testable)
- `units.js` — unit systems (metric/imperial), labels and API params
- `weather-codes.js` — WMO code → description + icon mapping
- `state.js` — observable store with validation, snapshots and `localStorage` persistence
- `ui.js` — DOM rendering (current, metrics, daily, hourly, suggestions, status)
- `search.js` — debounced autocomplete with combobox ARIA
- `app.js` — bootstrap, wiring and geolocation-first boot sequence

CSS is layered: `reset` → `tokens` → `base` → `layout` → `components`.

### What I learned

- Designing a small observable store with validated state, protected snapshots and reentrant-update handling.
- Keeping pure logic (weather codes, units, API parsing) separate and testable with Vitest.
- Building an accessible combobox and units menu with full keyboard support.
- Handling real-world edge cases: blank countries in geocoding results, missing forecast fields, denied geolocation, offline networks.

## Author

- GitHub - [@dimetuuna](https://github.com/dimetuuna)
- Frontend Mentor - [@dimetuuna](https://www.frontendmentor.io/profile/dimetuuna)

## Acknowledgments

Challenge by [Frontend Mentor](https://www.frontendmentor.io). Weather data by [Open-Meteo](https://open-meteo.com/). Built with assistance from an AI coding agent following a spec-driven, test-first workflow.