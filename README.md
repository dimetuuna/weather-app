# 🌤️ Weather App

A responsive weather application built as a solution to the [Weather app challenge on Frontend Mentor](https://www.frontendmentor.io/challenges/weather-app-K1FhddVm49).  
It fetches live data from the free [Open-Meteo API](https://open-meteo.com/) (no API key required) and presents current conditions, a 7-day forecast and an hourly forecast, with imperial/metric unit switching, autocomplete search, browser geolocation and an IP-based fallback.

[![Live Demo](https://img.shields.io/badge/Live-Demo-2ea44f?style=for-the-badge)](https://weather-app-dimetuuna-gmailcoms-projects.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/dimetuuna/weather-app)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-4.x-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Tests](https://img.shields.io/badge/Tests-125%20passing-brightgreen?style=flat-square)](https://github.com/dimetuuna/weather-app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

---

## ✨ Features

- 🔍 **Autocomplete search** — debounced geocoding suggestions (up to 5) with full keyboard navigation
- 🌡️ **Current conditions** — temperature, weather icon, location and description
- 📊 **Weather metrics** — "feels like", humidity, wind speed and precipitation
- 📅 **7-day forecast** — daily high/low with weather icons
- ⏱️ **Hourly forecast** — temperature changes throughout the day, day selector via native `<select>`
- ⚖️ **Units toggle** — switch between Imperial and Metric (temperature, wind, precipitation) via an accessible dropdown
- 📍 **Auto-location** — browser geolocation with an IP-based fallback
- 💾 **Persistence** — remembers the last searched location and preferred units in `localStorage`
- ♿ **Accessibility** — keyboard operable, visible focus rings, ARIA roles, `prefers-reduced-motion` support
- 📱 **Responsive** — mobile (375px) and desktop (1440px) layouts, mobile-first

## 🖼️ Screenshot

![Weather app screenshot](./preview.jpg)

> _Replace `preview.jpg` with a screenshot of your own build if you fork this repo._

## 🔗 Links

- **Live site:** [weather-app-dimetuuna-gmailcoms-projects.vercel.app](https://weather-app-dimetuuna-gmailcoms-projects.vercel.app)
- **Solution (this repo):** [github.com/dimetuuna/weather-app](https://github.com/dimetuuna/weather-app)
- **Challenge:** [Frontend Mentor — Weather app](https://www.frontendmentor.io/challenges/weather-app-K1FhddVm49)

## 🛠️ Built with

- Semantic **HTML5** markup
- **CSS** custom properties (design tokens), mobile-first, Grid & Flexbox
- **Vanilla JavaScript** (ES modules) — no framework
- [**Vite**](https://vitejs.dev/) — dev server, HMR and production build
- [**Vitest**](https://vitest.dev/) + jsdom — unit tests
- [**Open-Meteo API**](https://open-meteo.com/) — geocoding + forecast (free, no API key)
- Self-hosted variable fonts (**DM Sans**, **Bricolage Grotesque**)
- WCAG 2.2-minded accessibility

## 🏗️ Architecture

The app is split into small, single-responsibility modules under `js/`:

| Module | Responsibility |
|---|---|
| `api.js` | Open-Meteo geocoding + forecast fetchers (pure parsing, testable) |
| `units.js` | Unit systems (metric/imperial), labels and API params |
| `weather-codes.js` | WMO code → description + icon mapping |
| `state.js` | Observable store with validation, snapshots and `localStorage` persistence |
| `ui.js` | DOM rendering (current, metrics, daily, hourly, suggestions, status) + units dropdown |
| `search.js` | Debounced autocomplete with combobox ARIA |
| `app.js` | Bootstrap, wiring and geolocation-first boot sequence |

CSS is layered: `reset` → `tokens` → `base` → `layout` → `components`.

## 🚀 Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (tested with v24)
- npm (bundled with Node)

### Install & run

```bash
# Clone the repo
git clone https://github.com/dimetuuna/weather-app.git
cd weather-app

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Then open http://localhost:5173.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Vitest suite (125 tests) |
| `npm run test:watch` | Run tests in watch mode |

### Environment

No environment variables are required. The Open-Meteo API is free and keyless.

## 🧪 Testing

Pure logic is covered by Vitest:

- `weather-codes.test.js` — WMO code mapping and fallback
- `units.test.js` — unit labels, API params and toggling
- `api.test.js` — fetch parsing, empty results, error propagation
- `state.test.js` — store, validation, persistence, snapshots, reentrancy
- `units-dropdown.test.js` — accessible dropdown behaviour

```bash
npm test
```

## 📚 What I learned

- Designing a small observable store with validated state, protected snapshots and reentrant-update handling.
- Keeping pure logic (weather codes, units, API parsing) separate and testable.
- Building an accessible combobox and units menu with full keyboard support.
- Handling real-world edge cases: blank countries in geocoding results, missing forecast fields, denied geolocation, offline networks, IP-based fallback.

## 👤 Author

- GitHub — [@dimetuuna](https://github.com/dimetuuna)
- Frontend Mentor — [@dimetuuna](https://www.frontendmentor.io/profile/dimetuuna)

## 🙏 Acknowledgments

- Challenge by [Frontend Mentor](https://www.frontendmentor.io).
- Weather data by [Open-Meteo](https://open-meteo.com/).
- Built with assistance from an AI coding agent (OpenCode) following a spec-driven, test-first workflow.