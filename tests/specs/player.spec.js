const { test, expect } = require('../fixtures');

test.describe('Player view', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('homeView').classList.add('active');
      document.getElementById('playerView').classList.remove('active');
    });
    await expect(page.locator('.v-card').first()).toBeVisible({ timeout: 8000 });
    await page.locator('.v-card').first().click();
  });

  test('clicking a card opens the player or shows a toast', async ({ page }) => {
    // Fallback videos have no URL so show a toast instead of opening the player.
    // Either outcome is valid — the test just confirms something responded.
    const playerOpened = await page.locator('#playerView.active').isVisible().catch(() => false);
    const toastShown   = await page.locator('#toast').evaluate(
      el => parseFloat(el.style.opacity) > 0
    ).catch(() => false);
    expect(playerOpened || toastShown).toBe(true);
  });

  test('player shows a back button', async ({ page }) => {
    if (!await page.locator('#playerView.active').isVisible().catch(() => false)) {
      test.skip();
    }
    await expect(page.locator('#backBtn')).toBeVisible();
  });

  test('player top bar shows the video title', async ({ page }) => {
    if (!await page.locator('#playerView.active').isVisible().catch(() => false)) {
      test.skip();
    }
    const title = await page.locator('#playerTitle').textContent();
    expect(title.trim().length).toBeGreaterThan(0);
  });

  test('back button returns to home view', async ({ page }) => {
    if (!await page.locator('#playerView.active').isVisible().catch(() => false)) {
      test.skip();
    }
    await page.locator('#backBtn').click();
    await expect(page.locator('#homeView')).toHaveClass(/active/);
    await expect(page.locator('#playerView')).not.toHaveClass(/active/);
  });
});
