const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './specs',
  timeout: 30000,
  workers: 1, // single app instance — tests must be sequential
  globalSetup: './global-setup.js',
  globalTeardown: './global-teardown.js',
  use: {
    actionTimeout: 10000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
