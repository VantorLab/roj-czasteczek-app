// Deterministic check (fake clock): example shapes, hover modes, click modes, neon, hologram, own sign.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') console.log('C', m.text().slice(0, 200)); });
  const cdp = await p.context().newCDPSession(p);
  const shot = async n => { const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 160, y: 110, width: 420, height: 500, scale: 0.5 } }); fs.writeFileSync(`tools/pr-${n}.png`, Buffer.from(data, 'base64')); };
  await p.goto('http://localhost:8769/index.html'); await p.waitForTimeout(2500);
  await p.click('#tabs button[data-tab=look]'); await p.uncheck('#autoPerf'); await p.selectOption('#bg', 'black');
  await p.click('#tabs button[data-tab=shapes]'); await p.waitForTimeout(2500);
  await p.clock.install(); await p.waitForTimeout(300); await p.clock.pauseAt(Date.now() + 1000);
  const run = async sec => { for (let i = 0; i < Math.round(sec * 30); i++) await p.clock.runFor(1000 / 30); };
  const thumb = async i => p.evaluate(i => document.querySelectorAll('.shape .thumb')[i].click(), i);
  await run(3);
  // example shapes: heart, saturn, dna (cards 3-5), then knot/butterfly/vase/wave via card 5's type
  for (const [i, n] of [[2, 'heart'], [3, 'saturn'], [4, 'dna']]) { await thumb(i); await run(3.2); await shot('shape-' + n); }
  for (const t of ['knot', 'butterfly', 'vase', 'wave']) { await p.selectOption('.shape >> nth=4 >> select', t, { force: true }); await run(0.2); await thumb(0); await run(0.2); await thumb(4); await run(3.4); await shot('shape-' + t); }
  await thumb(0); await run(3.5);
  // hover modes on the flower
  await p.click('#tabs button[data-tab=motion]', { force: true });
  const c = await (await p.$('canvas.gl')).boundingBox(); const cx = c.x + c.width * 0.42, cy = c.y + c.height * 0.45;
  for (const m of ['0', '1', '2', '3', '4', '5']) {
    await p.selectOption('#hoverMode', m, { force: true });
    for (let k = 0; k < 8; k++) { await p.mouse.move(cx + Math.cos(k) * 30, cy + Math.sin(k) * 30); await run(0.08); }
    await run(0.5); await shot('hover-' + m);
    await p.mouse.move(c.x + 5, c.y + c.height - 5); await p.mouse.move(c.x - 50, c.y - 50); await run(2);
  }
  // click modes
  await p.selectOption('#hoverMode', '6', { force: true });
  for (const [m, t] of [['0', .4], ['1', .5], ['2', .9], ['3', .6], ['4', .8], ['5', 1.5], ['6', .6]]) {
    await p.selectOption('#clickMode', m, { force: true });
    await p.mouse.click(cx, cy); await run(t); await shot('click-' + m); await run(3); await thumb(0); await run(2.5);
  }
  // neon contour on a text shape, hologram, own sign
  await p.click('#tabs button[data-tab=shapes]', { force: true });
  await p.selectOption('.shape >> nth=1 >> select', 'text', { force: true }); await p.fill('.shape >> nth=1 >> input[type=text]', 'VANTOR', { force: true }); await run(1); await thumb(1); await run(3);
  await p.check('#contourOnly', { force: true }); await run(0.2); await p.selectOption('#colorMode', '1', { force: true }); await run(3.5); await shot('neon-text');
  await thumb(0); await run(3.5); await shot('neon-flower');
  await p.uncheck('#contourOnly', { force: true }); await p.selectOption('#colorMode', '0', { force: true }); await run(3);
  await p.click('#tabs button[data-tab=fx]', { force: true });
  await p.selectOption('#retroMode', '6', { force: true }); await run(1); await shot('holo');
  await p.selectOption('#retroMode', '0', { force: true });
  await p.selectOption('#pStyle', '8', { force: true }); await run(1); await shot('sign-star');
  await p.setInputFiles('#spriteFile', 'tools/logo.png'); await run(1.5); await shot('sign-logo');
  console.log('errors', errs.length, errs.slice(0, 3));
  await b.close();
})();
