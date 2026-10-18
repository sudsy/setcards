// Browser tests run against the static site on a phone-sized screen.
// Run `npm run lib` first so alphaTab is in lib/.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/browser',
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    ...devices['Pixel 7'],
    colorScheme: 'dark'
  },
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI
  }
});
