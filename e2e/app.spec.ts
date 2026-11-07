import { test, expect, openFresh, tab, cardText, canvasColorCount } from './fixtures';

const MODULES = ['vectors', 'matrix', 'bodies', 'span', 'eigen', 'lgs', 'gauss', 'kernel', 'gramschmidt'];

test.afterEach(async ({ errors, external }) => {
  expect(errors, 'Konsolenfehler').toEqual([]);
  expect(external, 'Anfragen an fremde Server').toEqual([]);
});

test('alle 9 Module laden, zeichnen etwas und werfen keine Fehler', async ({ page }) => {
  await openFresh(page);
  await expect(page.locator('.tab')).toHaveCount(MODULES.length);
  for (const id of MODULES) {
    await tab(page, id);
    await expect(page.locator(`.tab[data-id="${id}"]`)).toHaveClass(/active/);
    await expect(page.locator('.panel-body .card').first()).toBeVisible();
    await page.waitForTimeout(150);
    // Schutz gegen "leere Seite": das 3D-Bild muss Inhalt haben
    expect(await canvasColorCount(page), `3D-Bild in ${id} leer?`).toBeGreaterThan(20);
  }
});

test('Akzeptanz: v3 = (1,2,a) – bei a = 1 abhängig, Dimension 2, Ebene x − y + z = 0', async ({ page }) => {
  await openFresh(page);
  await tab(page, 'span');
  const aInput = page.locator('.panel-body .card').first().locator('input.num').last();
  await aInput.fill('1');
  const t = await cardText(page, 1);
  expect(t).toContain('linear abhängig');
  expect(t).toContain('dim span = 2');
  expect(t).toContain('x−y+z=0');
  // Rundweg −v1 − v2 + v3 = 0 (KaTeX fügt unsichtbare Leerzeichen ein)
  expect(await cardText(page, 2)).toMatch(/−v[\s\u200b]*1[\s\u200b]*−v[\s\u200b]*2[\s\u200b]*\+v[\s\u200b]*3[\s\u200b]*=0/);
  await aInput.fill('0');
  expect(await cardText(page, 1)).toContain('linear unabhängig');
});

test('ungültige Eingaben werden markiert, ohne dass die App abstürzt', async ({ page }) => {
  await openFresh(page);
  const first = page.locator('.vec-editor input.num').first();
  await first.fill('1/');
  await expect(first).toHaveClass(/invalid/);
  await expect(page.locator('.note-error').first()).toContainText('Ungültige Eingabe');
  await first.fill('sqrt.constructor');
  await expect(first).toHaveClass(/invalid/);
  await first.fill('2');
  await expect(first).not.toHaveClass(/invalid/);
  await tab(page, 'matrix'); // App reagiert weiterhin
  await expect(page.locator('.panel-title')).toHaveText('Matrizen als Transformation');
});

test('Vektoren: Auswahl a + c, Löschen eines gewählten Vektors, Rechenweg', async ({ page }) => {
  await openFresh(page);
  await page.click('button:has-text("+ Vektor")');
  await page.locator('.panel-body .card').nth(1).locator('select').nth(1).selectOption({ label: 'c' });
  await expect(page.locator('.panel-body .card').nth(1)).toContainText('a + c');
  await page.locator('.vec-item').nth(2).locator('button.danger').click();
  await expect(page.locator('.panel-body .card').nth(1)).toContainText('a + b');
  await page.locator('details.calc summary').first().click();
  await expect(page.locator('details.calc').first()).toHaveAttribute('open', '');
});

test('Zahlen per Maus ziehen (Scrubbing) und Pfeiltasten', async ({ page }) => {
  await openFresh(page);
  const f = page.locator('.vec-editor input.num').first();
  const b = (await f.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(f).toHaveValue('3'); // 2 + 10 Schritte à 0.1
  await f.click();
  await page.keyboard.press('ArrowUp');
  await expect(f).toHaveValue('3.1');
});

test('Gauß-Trainer: Vorführen bis zur Lösung (1, 2, 3)', async ({ page }) => {
  await openFresh(page);
  await tab(page, 'gauss');
  await page.click('text=Nächster Schritt ▶');
  await expect(page.locator('.explain')).toContainText('Faktor');
  await page.click('button:has-text("⏭")');
  const back = await cardText(page, 4);
  expect(back).toContain('z=3');
  expect(back).toContain('y=2');
  expect(back).toContain('x=1');
  expect(back).toContain('genau eine Lösung');
});

test('Gauß-Trainer: Selbst rechnen mit Tipps und Erkennung von Widersprüchen', async ({ page }) => {
  await openFresh(page);
  await tab(page, 'gauss');
  await page.click('button:has-text("Keine Lösung")');
  await page.click('text=✎ Selbst rechnen');
  for (let i = 0; i < 3; i++) { await page.click('text=💡 Tipp'); await page.click('button:has-text("Ausführen")'); }
  await expect(page.locator('.badge.ok', { hasText: 'Zeilenstufenform erreicht' })).toBeVisible();
  expect(await cardText(page, 4)).toContain('Widerspruch');
  await page.click('button:has-text("↶ Rückgängig")');
  await expect(page.locator('.badge.warn', { hasText: 'noch keine Zeilenstufenform' })).toBeVisible();
});

test('Zustand bleibt nach Neuladen erhalten (localStorage)', async ({ page }) => {
  await openFresh(page);
  await page.locator('.vec-editor input.num').first().fill('4');
  await tab(page, 'lgs');
  await page.waitForTimeout(400); // Speichern ist entprellt
  await page.reload();
  await expect(page.locator('.tab[data-id="lgs"]')).toHaveClass(/active/);
  await tab(page, 'vectors');
  await expect(page.locator('.vec-editor input.num').first()).toHaveValue('4');
});

test('Akku-Schonung: im Leerlauf wird nicht neu gezeichnet', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __frames: number }).__frames = 0;
    for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const orig = C.prototype.clear;
      C.prototype.clear = function (this: WebGLRenderingContext, m: number) {
        (window as unknown as { __frames: number }).__frames++;
        return orig.call(this, m);
      };
    }
  });
  await openFresh(page);
  const frames = () => page.evaluate(() => (window as unknown as { __frames: number }).__frames);
  await page.waitForTimeout(1000);
  const a = await frames();
  await page.waitForTimeout(2000);
  expect(await frames()).toBe(a); // Leerlauf: 0 neue Frames
  await tab(page, 'matrix');
  await page.click('text=▶ Anwenden');
  await page.waitForTimeout(1500);
  expect(await frames()).toBeGreaterThan(a + 20); // Animation läuft flüssig
});

test('Energiesparmodus: standardmäßig an, halbiert Bildrate, abschaltbar', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __frames: number }).__frames = 0;
    for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const orig = C.prototype.clear;
      C.prototype.clear = function (this: WebGLRenderingContext, m: number) {
        (window as unknown as { __frames: number }).__frames++;
        return orig.call(this, m);
      };
    }
  });
  await openFresh(page);
  const eco = page.locator('button[aria-label="Energiesparen"]');
  await expect(eco).toHaveClass(/active/);
  const frames = () => page.evaluate(() => (window as unknown as { __frames: number }).__frames);
  const during = async () => {
    await tab(page, 'matrix');
    const a = await frames();
    await page.click('text=▶ Anwenden');
    await page.waitForTimeout(1200);
    return (await frames()) - a;
  };
  const ecoFrames = await during();
  await eco.click();
  await expect(eco).not.toHaveClass(/active/);
  const fullFrames = await during();
  expect(ecoFrames).toBeLessThanOrEqual(40); // ≈ 30 fps
  expect(fullFrames).toBeGreaterThan(ecoFrames);
});

test('mobile Ansicht: Panel und Tabs sind bedienbar @mobil', async ({ page }) => {
  await openFresh(page);
  await expect(page.locator('.panel')).toBeVisible();
  await page.locator('.tab[data-id="gauss"]').click();
  await expect(page.locator('.panel-title')).toHaveText('Gauß-Verfahren verstehen');
  await page.click('.panel-toggle');
  await expect(page.locator('.panel')).toHaveClass(/collapsed/);
  // während der Einklapp-Animation wird die Zeichenfläche kurz neu angelegt → kurz warten
  await expect.poll(() => canvasColorCount(page)).toBeGreaterThan(20);
});
