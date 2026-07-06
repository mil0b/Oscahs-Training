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
    // Setup form has two password fields (new + confirm); login form has one — either is valid.
    await expect(page.locator('#adminAuthBox input[type="password"]').first()).toBeVisible({ timeout: 8000 });
  });

  test('closes on Escape', async ({ page }) => {
    await page.locator('#adminBtn').click();
    await expect(page.locator('#adminAuthOverlay')).not.toHaveClass(/hidden/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#adminAuthOverlay')).toHaveClass(/hidden/);
  });

  test('Enter key submits the login form', async ({ page }) => {
    await page.locator('#adminBtn').click();
    // The admin/status check is async — wait for whichever form actually renders
    // before deciding whether this test's precondition (login form) is met.
    await expect(page.locator('#adminAuthBox input[type="password"]').first()).toBeVisible({ timeout: 8000 });
    if (await page.locator('#setupPw1').count() > 0) test.skip();
    const pwInput = page.locator('#loginPw');
    await pwInput.fill('wrongpassword');
    await pwInput.press('Enter');
    // Should show an error (wrong password) — confirms Enter was handled
    await expect(page.locator('#authError')).toBeVisible({ timeout: 5000 });
  });

  test('Enter key on setup form moves focus to confirm field', async ({ page }) => {
    await page.locator('#adminBtn').click();
    await expect(page.locator('#adminAuthBox input[type="password"]').first()).toBeVisible({ timeout: 8000 });
    if (await page.locator('#setupPw1').count() === 0) test.skip();
    await page.locator('#setupPw1').fill('some-password');
    await page.locator('#setupPw1').press('Enter');
    await expect(page.locator('#setupPw2')).toBeFocused();
  });
});
