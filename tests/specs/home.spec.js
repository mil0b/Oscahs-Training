const { test, expect } = require('../fixtures');

async function resetHome(page) {
  // Return app to a clean home state without a full reload
  await page.evaluate(() => {
    document.getElementById('homeView').classList.add('active');
    document.getElementById('playerView').classList.remove('active');
    document.getElementById('adminAuthOverlay').classList.add('hidden');
    document.getElementById('adminPanelOverlay').classList.add('hidden');
    document.getElementById('folderOverlay').classList.add('hidden');
  });
}

test.describe('Home view', () => {
  test.beforeEach(async ({ page }) => {
    await resetHome(page);
  });

  test('home view is active on load', async ({ page }) => {
    await expect(page.locator('#homeView')).toHaveClass(/active/);
  });

  test('renders video cards', async ({ page }) => {
    await expect(page.locator('.v-card').first()).toBeVisible({ timeout: 8000 });
    expect(await page.locator('.v-card').count()).toBeGreaterThan(0);
  });

  test('shows OSCAHS logo in header', async ({ page }) => {
    await expect(page.locator('.logo-img')).toBeVisible();
  });

  test('shows category filter pills including All', async ({ page }) => {
    await expect(page.locator('[data-cat="All"]')).toBeVisible();
    expect(await page.locator('.cat-pill').count()).toBeGreaterThan(1);
  });
});

test.describe('Category filter', () => {
  test.beforeEach(async ({ page }) => {
    await resetHome(page);
    await expect(page.locator('.v-card').first()).toBeVisible({ timeout: 8000 });
  });

  test('"All" pill is selected by default', async ({ page }) => {
    await expect(page.locator('[data-cat="All"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('clicking a category pill filters the grid', async ({ page }) => {
    const nonAll = page.locator('.cat-pill:not([data-cat="All"])');
    if (await nonAll.count() === 0) test.skip();

    const pill    = nonAll.first();
    const catName = await pill.getAttribute('data-cat');
    await pill.click();

    await expect(pill).toHaveAttribute('aria-pressed', 'true');

    const badges = page.locator('.card-cat-badge');
    for (let i = 0; i < await badges.count(); i++) {
      expect((await badges.nth(i).textContent()).trim()).toBe(catName);
    }
  });

  test('clicking All restores the full grid', async ({ page }) => {
    await page.locator('.cat-pill:not([data-cat="All"])').first().click();
    await page.locator('[data-cat="All"]').click();

    const allPill   = page.locator('[data-cat="All"]');
    const countText = await allPill.locator('.pill-count').textContent();
    await expect(allPill).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('.v-card').count()).toBe(parseInt(countText, 10));
  });
});
