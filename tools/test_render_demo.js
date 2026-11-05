// Renders the self-playing demo with the app's own frame-by-frame renderer (deterministic) and saves the MP4.
// Video A: default examples. Video B: neon text + knot, butterfly, vase, wave.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const variant of ['A', 'B']) {
    const ctx = await b.newContext({ viewport: { width: 1100, height: 720 }, acceptDownloads: true });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8769/index.html'); await p.waitForTimeout(2600);   // demo has set the tour sequence
    await p.evaluate(v => {
      const set = (sel, i, val, ev = 'change') => { const el = document.querySelectorAll(sel)[i]; el.value = val; el.dispatchEvent(new Event(ev)); };
      document.getElementById('autoPerf').checked = false;
      document.getElementById('bg').value = 'black'; document.getElementById('bg').dispatchEvent(new Event('input'));
      if (v === 'B') {
        ['knot', 'butterfly', 'vase', 'wave'].forEach((t, k) => set('.shape select', k + 1, t));
        set('.shape select', 0, 'text');
      }
      document.getElementById('rRes').value = '720';
    }, variant);
    if (variant === 'B') {
      await p.waitForTimeout(400);
      await p.evaluate(() => {
        const t = document.querySelectorAll('.shape input[type=text]')[0]; t.value = 'VANTOR'; t.dispatchEvent(new Event('input'));
        const c = document.getElementById('contourOnly'); c.checked = true; c.dispatchEvent(new Event('change'));
        const m = document.getElementById('colorMode'); m.value = '1'; m.dispatchEvent(new Event('input'));
      });
      await p.waitForTimeout(1500);
    }
    await p.evaluate(() => document.getElementById('btnRender').click());
    await p.waitForFunction(() => !document.getElementById('preview').hidden, null, { timeout: 900000, polling: 2000 });
    const dl = p.waitForEvent('download', { timeout: 60000 });
    await p.evaluate(() => document.getElementById('btnSaveVid').click());
    await (await dl).saveAs(`tools/demo-${variant}.mp4`);
    console.log(variant, 'saved |', await p.$eval('#recNote', e => e.textContent), '| errors', errs.length, errs.slice(0, 2));
    await ctx.close();
  }
  await b.close();
})();
