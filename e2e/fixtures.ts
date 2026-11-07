/**
 * Gemeinsame Test-Hilfen: sammelt Konsolenfehler und blockiert alle
 * Anfragen an fremde Server (die App muss komplett offline funktionieren).
 */
import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ errors: string[]; external: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await use(errors);
  },
  external: async ({ page, baseURL }, use) => {
    const external: string[] = [];
    const origin = new URL(baseURL!).origin;
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      external.push(url);
      return route.abort();
    });
    await use(external);
  },
});
export { expect };

/** App frisch öffnen (ohne gespeicherten Zustand) */
export async function openFresh(page: Page) {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.tab').first()).toBeVisible();
}

export const tab = (page: Page, id: string) => page.click(`.tab[data-id="${id}"]`);

/** Text eines Panels (Whitespace normalisiert) */
export async function cardText(page: Page, index: number) {
  return (await page.locator('.panel-body .card').nth(index).innerText()).replace(/\s+/g, ' ');
}

/** Prüft, dass das 3D-Bild nicht leer ist (genug unterschiedliche Farben) */
export async function canvasColorCount(page: Page) {
  return page.evaluate(() => {
    const src = document.querySelector('.viewport canvas') as HTMLCanvasElement;
    const c = document.createElement('canvas');
    c.width = 200; c.height = 120;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const colors = new Set<number>();
    for (let i = 0; i < d.length; i += 4) colors.add(((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3));
    return colors.size;
  });
}
