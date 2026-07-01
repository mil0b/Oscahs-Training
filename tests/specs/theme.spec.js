const { test, expect } = require('../fixtures');

test.describe('Dark mode toggle', () => {
  test.beforeEach(async ({ page }) => {
    // Force light mode as a known baseline
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('oscahs-theme', 'light');
    });
  });

  test('clicking theme button switches to dark mode', async ({ page }) => {
    await page.locator('#themeBtn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('clicking theme button twice returns to light mode', async ({ page }) => {
    await page.locator('#themeBtn').click();
    await page.locator('#themeBtn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('preference is persisted to localStorage', async ({ page }) => {
    await page.locator('#themeBtn').click();
    const stored = await page.evaluate(() => localStorage.getItem('oscahs-theme'));
    expect(stored).toBe('dark');
  });
});
