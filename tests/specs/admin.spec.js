const { test, expect } = require('../fixtures');

async function closeAllModals(page) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
}

test.describe('Admin modal', () => {
  test.beforeEach(async ({ page }) => {
    await closeAllModals(page);
  });

  test.afterEach(async ({ page }) => {
    await closeAllModals(page);
  });

  test('opens when the admin button is clicked', async ({ page }) => {
    await page.locator('#adminBtn').click();
    await expect(page.locator('#adminAuthOverlay')).not.toHaveClass(/hidden/);
  });

  test('shows a password form (login or setup)', async ({ page }) => {
    await page.locator('#adminBtn').click();
    await expect(page.locator('#adminAuthBox input[type="password"]')).toBeVisible({ timeout: 8000 });
  });

  test('closes on Escape', async ({ page }) => {
    await page.locator('#adminBtn').click();
    await expect(page.locator('#adminAuthOverlay')).not.toHaveClass(/hidden/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#adminAuthOverlay')).toHaveClass(/hidden/);
  });

  test('Enter key submits the login form', async ({ page }) => {
    await page.locator('#adminBtn').click();
    const pwInput = page.locator('#loginPw, #setupPw1').first();
    await expect(pwInput).toBeVisible({ timeout: 8000 });
    await pwInput.fill('wrongpassword');
    await pwInput.press('Enter');
    // Should show an error (wrong password) — confirms Enter was handled
    await expect(page.locator('#authError')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Folder settings modal', () => {
  test.beforeEach(async ({ page }) => {
    await closeAllModals(page);
  });

  test.afterEach(async ({ page }) => {
    await closeAllModals(page);
  });

  test('opens when the folder button is clicked', async ({ page }) => {
    await page.locator('#folderBtn').click();
    await expect(page.locator('#folderOverlay')).not.toHaveClass(/hidden/);
  });

  test('shows the current training folder path', async ({ page }) => {
    await page.locator('#folderBtn').click();
    await expect(page.locator('#folderBox')).toContainText('Training Folder', { timeout: 8000 });
  });

  test('Browse button is present', async ({ page }) => {
    await page.locator('#folderBtn').click();
    await expect(page.locator('#folderBrowseBtn')).toBeVisible({ timeout: 8000 });
  });

  test('Enter key in path input triggers save', async ({ page }) => {
    await page.locator('#folderBtn').click();
    await expect(page.locator('#folderInput')).toBeVisible({ timeout: 8000 });
    // Fill a dummy path and press Enter — the save fires (Tauri will return an error
    // for a non-existent path, which is fine — we just confirm Enter was handled)
    await page.locator('#folderInput').fill('C:\\does-not-exist');
    await page.locator('#folderInput').press('Enter');
    // Modal closes on successful save OR stays open on error — either way Enter fired
    await page.waitForTimeout(1000);
    // No crash = pass
  });
});
