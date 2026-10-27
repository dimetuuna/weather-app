import { defineConfig } from 'vitest/config';

// Vite serves the app from the project root; Vitest runs the unit tests in jsdom
// so DOM-touching modules can be tested without a browser.
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
