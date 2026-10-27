# Weather App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Frontend Mentor Weather app (vanilla HTML/CSS/JS + Vite/Vitest) consuming Open-Meteo, with autocomplete search, units toggle, 7-day + hourly forecast, states, persistence, and accessibility.

**Architecture:** Static app served by Vite; ES modules split by responsibility (api, state, ui, units, weather-codes, app). Mobile-first CSS with design tokens. TDD for pure logic (weather-codes, units, api parsing).

**Tech Stack:** Vite, Vitest, vanilla JS (ES modules), CSS custom properties, Open-Meteo (geocoding + forecast).

**Spec:** `docs/superpowers/specs/2026-10-27-weather-app-design.md` (design approved in chat; to be written if requested).

## Global Constraints

- No UI framework; vanilla HTML/CSS/JS only.
- Vite for dev/build; Vitest for tests; no other test runner.
- Mobile-first responsive (designs at 375px and 1440px); breakpoints ~768px and ~1024px.
- WCAG: full keyboard operability, visible focus, ARIA on dropdown/combobox, `prefers-reduced-motion` respected.
- Self-hosted fonts (DM Sans variable, Bricolage Grotesque) via `@font-face`, `font-display: swap`.
- Open-Meteo only; no API key; geocoding + forecast endpoints.
- Units toggle triggers a refetch with API unit params (no client-side conversion).
- States: `idle | loading | success | empty | error`; error state has Retry.
- Persistence in `localStorage`: `units`, `lastLocation`.
- Autocomplete shows up to 5 suggestions.
- Geolocation on boot with graceful fallback.
- Native `<select>` for hourly day selector.

## Review Focus

1. Empty/whitespace search query → must not trigger geocoding; no crash, no empty flash.
2. Network failure / offline → error state with Retry; app stays usable.
3. Geolocation denied or unsupported → fallback to lastLocation or initial state, no blocking error.
4. Unknown WMO weather code → fallback icon/description, not crash.
5. Missing/null fields in API response → defensive parsing; no `NaN`/`undefined` in UI.

---

### Task 1: Scaffold project

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `css/reset.css`, `css/tokens.css`, `css/base.css`, `css/layout.css`, `css/components.css`
- Create: `js/app.js`, `js/api.js`, `js/state.js`, `js/units.js`, `js/weather-codes.js`, `js/ui.js`
- Create: `tests/weather-codes.test.js`, `tests/units.test.js`, `tests/api.test.js`

**Interfaces:**
- Produces: dev scripts `dev`, `build`, `test`, `preview`.

- [ ] **Step 1: Create `package.json`** with name, type module, scripts (`dev: vite`, `build: vite build`, `preview: vite preview`, `test: vitest run`, `test:watch: vitest`), devDependencies `vite`, `vitest`.
- [ ] **Step 2: Create `vite.config.js`** exporting default config with `test: { environment: 'jsdom' }` and `root` default.
- [ ] **Step 3: Create `index.html`** with semantic skeleton: header (units dropdown + search), main (current hero, metrics grid, daily forecast, hourly forecast), footer attribution. Link CSS files and `js/app.js` (type module). Include font @font-face via tokens/base.
- [ ] **Step 4: Create empty module stubs** (`export {}` or minimal) so imports resolve.
- [ ] **Step 5: Run `npm install` then `npm run dev`** to verify scaffold boots (no errors). Expected: dev server starts, page loads.
- [ ] **Step 6: Commit** `chore: scaffold vite project`.

---

### Task 2: Design tokens and base styles

**Files:**
- Modify: `css/tokens.css`
- Modify: `css/base.css`
- Modify: `css/reset.css`

**Interfaces:**
- Produces: CSS variables `--color-*`, `--font-*`, `--space-*`, `--radius-*`, `--bp-*` (media queries in files).

- [ ] **Step 1: Write tokens** for all colors in style-guide.md, font families, base font size 18px, spacing scale (4/8px), radii, shadows.
- [ ] **Step 2: Add `@font-face`** for DM Sans (variable) and Bricolage Grotesque (bold) from `../assets/fonts/...`, `font-display: swap`.
- [ ] **Step 3: Reset** (box-sizing, margin reset, img max-width) and base typography (body font, line-height, color).
- [ ] **Step 4: Verify** visually in dev (fonts load, colors apply). Expected: no 404s in network tab for fonts.
- [ ] **Step 5: Commit** `feat: add design tokens and base styles`.

---

### Task 3: Weather code mapping (TDD)

**Files:**
- Create/Modify: `js/weather-codes.js`
- Test: `tests/weather-codes.test.js`

**Interfaces:**
- Produces: `weatherCodes` object; `getWeatherInfo(code) -> { description, icon }`.

- [ ] **Step 1: Write failing test** asserting `getWeatherInfo(0)` → `{ description: 'Clear sky', icon: 'icon-sunny.webp' }`, `getWeatherInfo(3)` → overcast, `getWeatherInfo(99)` → storm, and unknown code `999` → fallback `{ description: 'Unknown', icon: 'icon-overcast.webp' }`.
- [ ] **Step 2: Run test** `npm test -- tests/weather-codes.test.js`. Expected: FAIL (module/function missing).
- [ ] **Step 3: Implement** `weatherCodes` map grouping WMO codes into 8 categories (sunny, partly-cloudy, overcast, fog, drizzle, rain, snow, storm) and `getWeatherInfo` with fallback.
- [ ] **Step 4: Run test**. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add weather code mapping`.

---

### Task 4: Units definitions (TDD)

**Files:**
- Create/Modify: `js/units.js`
- Test: `tests/units.test.js`

**Interfaces:**
- Produces: `UNITS = { metric, imperial }` with labels and API params; `getUnitConfig(key)`, `toggleUnits(current)`.

- [ ] **Step 1: Write failing test** for metric labels (°C, km/h, mm), imperial labels (°F, mph, in), API params, and toggle metric↔imperial.
- [ ] **Step 2: Run test**. Expected: FAIL.
- [ ] **Step 3: Implement** units config and helpers.
- [ ] **Step 4: Run test**. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add units definitions`.

---

### Task 5: API layer (TDD)

**Files:**
- Create/Modify: `js/api.js`
- Test: `tests/api.test.js`

**Interfaces:**
- Produces: `searchLocations(query) -> Promise<Array<{name,country,admin1,lat,lon}>>`; `fetchForecast(lat, lon, units) -> Promise<{current,daily,hourly}>`; `fetchByCoords(lat, lon, units)` (alias).

- [ ] **Step 1: Write failing tests** with mocked `fetch` (vi.stubGlobal) for geocoding parsing and forecast parsing; plus empty-results case and network-error rejection.
- [ ] **Step 2: Run test**. Expected: FAIL.
- [ ] **Step 3: Implement** fetch calls with proper query params, defensive parsing (null-safe), and error propagation.
- [ ] **Step 4: Run test**. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add api layer`.

---

### Task 6: State management

**Files:**
- Create/Modify: `js/state.js`

**Interfaces:**
- Produces: `createStore()` with `getState()`, `setState(partial)`, `subscribe(fn)`, plus `loadPersisted()`, `persist()`.

- [ ] **Step 1: Implement** state shape `{ location, units, selectedDayIndex, status, data, error }` and localStorage sync for `units`/`lastLocation`.
- [ ] **Step 2: Manual verification** in dev console: set state, reload, confirm persistence. Expected: units/lastLocation restored.
- [ ] **Step 3: Commit** `feat: add state management`.

---

### Task 7: UI render functions

**Files:**
- Create/Modify: `js/ui.js`
- Modify: `css/components.css`, `css/layout.css`

**Interfaces:**
- Consumes: state shape, weather-codes, units.
- Produces: `renderCurrent`, `renderMetrics`, `renderDaily`, `renderHourly`, `renderSuggestions`, `renderStatus` (loading/empty/error).

- [ ] **Step 1: Implement render functions** using DOM APIs (createElement/textContent), no innerHTML for untrusted data.
- [ ] **Step 2: Add CSS** for components and responsive grid.
- [ ] **Step 3: Manual verification** with mock data in dev. Expected: all sections render, no NaN.
- [ ] **Step 4: Commit** `feat: add ui rendering`.

---

### Task 8: Units dropdown (accessibility)

**Files:**
- Modify: `js/ui.js` or `js/app.js`
- Modify: `css/components.css`

**Interfaces:**
- Consumes: state.units; produces: `toggleUnitsDropdown()`, keyboard handlers.

- [ ] **Step 1: Implement dropdown** with `aria-expanded`, `aria-haspopup`, roles, keyboard (arrows/Enter/Escape), click-outside close.
- [ ] **Step 2: Wire to state** → refetch on change.
- [ ] **Step 3: Manual a11y check** keyboard-only. Expected: operable without mouse.
- [ ] **Step 4: Commit** `feat: add accessible units dropdown`.

---

### Task 9: Search with autocomplete

**Files:**
- Modify: `js/app.js`, `js/ui.js`

**Interfaces:**
- Consumes: `searchLocations`; produces: suggestion selection → fetch.

- [ ] **Step 1: Implement debounced input** (300ms) → geocoding → render suggestions (≤5).
- [ ] **Step 2: Implement combobox ARIA** (`role="combobox"`, `aria-autocomplete`, `aria-controls`, `aria-activedescendant`) + keyboard nav (arrows/Enter/Escape).
- [ ] **Step 3: Handle empty/no-results states**.
- [ ] **Step 4: Manual verification**. Expected: typing shows suggestions, selection loads weather.
- [ ] **Step 5: Commit** `feat: add search with autocomplete`.

---

### Task 10: Hourly day selector + geolocation boot

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: state; `fetchForecast`; geolocation API.

- [ ] **Step 1: Implement native `<select>`** for day → update `selectedDayIndex` → re-render hourly (no fetch).
- [ ] **Step 2: Implement boot sequence**: geolocation → fetch; fallback to lastLocation; fallback to initial state.
- [ ] **Step 3: Manual verification** (allow/deny permission). Expected: graceful in both cases.
- [ ] **Step 4: Commit** `feat: add hourly selector and geolocation boot`.

---

### Task 11: Accessibility polish

**Files:**
- Modify: `css/components.css`, `js/ui.js`

**Interfaces:**
- Produces: focus-visible styles, live region, reduced-motion handling.

- [ ] **Step 1: Add focus-visible ring** (Blue 500) to all interactive elements.
- [ ] **Step 2: Add `aria-live="polite"` region** announcing loaded weather.
- [ ] **Step 3: Add `@media (prefers-reduced-motion)`** to disable transitions.
- [ ] **Step 4: Manual check** with keyboard + screen reader smoke test.
- [ ] **Step 5: Commit** `feat: accessibility polish`.

---

### Task 12: Loading/error/empty states + final verification

**Files:**
- Modify: `js/ui.js`, `css/components.css`

**Interfaces:**
- Consumes: state.status.

- [ ] **Step 1: Implement loading spinner** (icon-loading.svg), error state (icon-error.svg + Retry), empty state.
- [ ] **Step 2: Wire Retry** to re-dispatch last fetch.
- [ ] **Step 3: Run full test suite** `npm test`. Expected: all pass.
- [ ] **Step 4: Build** `npm run build`. Expected: success, no errors.
- [ ] **Step 5: Manual responsive check** 320px–1440px, offline simulation. Expected: no layout break, error state shows.
- [ ] **Step 6: Commit** `feat: add states and final verification`.

---

Plan complete. Please review the plan. Which execution approach would you prefer?

- **Subagent-driven** — fresh subagent per task + review per task + final branch review. Most thorough.
- **Native** — I implement all tasks in this session, then one review at the end. Fastest.

Given the tasks share interfaces heavily (state/ui/api), I recommend **Native** for speed, with the plan carrying the design. Does the plan capture what you want, and which approach should we use?