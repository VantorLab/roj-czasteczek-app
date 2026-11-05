// Real-time check of the new example shapes, neon contour on text, hologram and own-sign particles.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const clip = { x: 160, y: 110, width: 420, height: 500 };
  const ev = (f, a) => p.evaluate(f, a);
  await p.goto('http://localhost:8769/index.html'); await p.waitForTimeout(2000);
  await p.click('#tabs button[data-tab=look]'); await p.uncheck('#autoPerf'); await p.selectOption('#count', '128'); await p.selectOption('#bg', 'black');
  await p.click('#tabs button[data-tab=shapes]'); await p.waitForTimeout(1500);
  const thumb = i => ev(i => document.querySelectorAll('.shape .thumb')[i].click(), i);
  for (const [i, n] of [[2, 'heart'], [3, 'saturn'], [4, 'dna']]) { await thumb(i); await p.waitForTimeout(4500); await p.screenshot({ path: `tools/pr-shape-${n}.png`, clip }); }
  for (const t of ['knot', 'butterfly', 'vase', 'wave']) {
    await ev(t => { const s = document.querySelectorAll('.shape select')[4]; s.value = t; s.dispatchEvent(new Event('change')); }, t);
    await p.waitForTimeout(300); await thumb(0); await p.waitForTimeout(400); await thumb(4); await p.waitForTimeout(4500); await p.screenshot({ path: `tools/pr-shape-${t}.png`, clip });
  }
  // neon contour on a text shape
  await ev(() => { const s = document.querySelectorAll('.shape select')[1]; s.value = 'text'; s.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(300);
  await ev(() => { const t = document.querySelectorAll('.shape input[type=text]')[1]; t.value = 'VANTOR'; t.dispatchEvent(new Event('input')); });
  await p.waitForTimeout(800); await thumb(1); await p.waitForTimeout(3000);
  await p.check('#contourOnly'); await p.click('#tabs button[data-tab=look]'); await p.selectOption('#colorMode', '1'); await p.waitForTimeout(4500);
  await p.screenshot({ path: 'tools/pr-neon-text.png', clip });
  await p.click('#tabs button[data-tab=shapes]'); await p.uncheck('#contourOnly'); await p.click('#tabs button[data-tab=look]'); await p.selectOption('#colorMode', '0');
  await thumb(0); await p.waitForTimeout(4000);
  await p.click('#tabs button[data-tab=fx]'); await p.selectOption('#retroMode', '6'); await p.waitForTimeout(1500); await p.screenshot({ path: 'tools/pr-holo.png', clip });
  await p.selectOption('#retroMode', '0'); await p.selectOption('#pStyle', '8'); await p.waitForTimeout(1500); await p.screenshot({ path: 'tools/pr-sign-star.png', clip });
  await p.setInputFiles('#spriteFile', 'tools/logo.png'); await p.waitForTimeout(2000); await p.screenshot({ path: 'tools/pr-sign-logo.png', clip });
  console.log('errors', errs.length, errs.slice(0, 3));
  await b.close();
})();
