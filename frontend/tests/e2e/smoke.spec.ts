import { expect, test } from '@playwright/test';

// Smoke test skeleton - NEEDS a running backend (Django dev server or the
// full docker-compose stack) with at least one seeded user and one seeded
// person/burial place to actually pass. It is intentionally NOT run in CI
// yet (see playwright.config.ts and ci.yml comments) - run it locally with
// `npm run test:e2e` after starting both dev servers, e.g. via the
// top-level `python main.py`.
//
// Seed data assumed below (adjust to match whatever fixtures/manage.py
// commands the backend ends up providing):
//   - a user: username "smoketest", password "smoketest-password123"
//   - at least one Person with a family relation, so the tree renders a node
//   - at least one BurialPlace with valid latitude/longitude, so the map
//     renders a placemark

test.describe('Велес smoke test', () => {
  test('login -> tree renders -> map renders', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Имя пользователя').fill('smoketest');
    await page.getByLabel('Пароль').fill('smoketest-password123');
    await page.getByRole('button', { name: 'Войти' }).click();

    // Successful login redirects to /tree (RequireAuth + "/" -> "/tree").
    await expect(page).toHaveURL(/\/tree$/);

    // family-chart renders its SVG tree inside this container once
    // GET /api/tree/ resolves with at least one node.
    const treeContainer = page.locator('.tree-view-container');
    await expect(treeContainer).toBeVisible();
    await expect(treeContainer.locator('svg')).toBeVisible();

    // Navigate to the map and confirm the Yandex Maps iframe/canvas mounts.
    await page.getByRole('link', { name: 'Карта' }).click();
    await expect(page).toHaveURL(/\/map$/);

    const mapContainer = page.locator('.map-view-container');
    await expect(mapContainer).toBeVisible();
    // Yandex Maps renders into a ymaps-specific container class once the
    // JS API script loads - this assertion needs a real VITE_YANDEX_MAPS_API_KEY.
    await expect(mapContainer.locator('.ymaps-2-1-79-map, [class*="ymaps"]').first()).toBeVisible({
      timeout: 15000,
    });
  });
});
