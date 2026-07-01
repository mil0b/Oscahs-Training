const { test: base, expect, chromium } = require('@playwright/test');

// Shared fixture: connects to the running Tauri app via CDP.
// Each test file gets a page; beforeEach resets to a clean home state.
exports.test = base.extend({
  page: async ({}, use) => {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    const page    = context.pages()[0];
    await use(page);
    // Disconnect only — do not close, the app keeps running between tests.
    await browser.close();
  },
});

exports.expect = expect;
