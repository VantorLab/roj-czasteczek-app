// Each particle look on the formed table, then the Matrix rain scenario at exact sim times.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('C', m.text().slice(0, 300)); });
  const cdp = await p.context().newCDPSession(p);
  const shot = async path => { const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 120, y: 60, width: 520, height: 600, scale: 0.5 } }); fs.writeFileSync(path, Buffer.from(data, 'base64')); };
  await p.goto('http://localhost:8769/index.html'); await p.waitForTimeout(3000);
  await p.selectOption('#bgMode', 'none'); await p.setInputFiles('.shape input[type=file] >> nth=0', 'tools/stol.jpg'); await p.waitForTimeout(1500);
  await p.click('#tabs button[data-tab=look]'); await p.uncheck('#autoPerf'); await p.selectOption('#bg', 'black');
  await p.click('#tabs button[data-tab=fx]');
  await p.clock.install(); await p.waitForTimeout(300); await p.clock.pauseAt(Date.now() + 1000);
  const run = async sec => { for (let i = 0; i < Math.round(sec * 30); i++) await p.clock.runFor(1000 / 30); };
  await run(5);
  for (let v = 0; v < 8; v++) { await p.selectOption('#pStyle', String(v)); await run(0.5); await shot(`tools/st-${v}.png`); }
  // a moving frame for motion streaks
  await p.selectOption('#pStyle', '3'); await p.keyboard.press(' '); await run(0.6); await shot('tools/st-3b.png'); await run(4);
  await p.click('#tabs button[data-tab=seq]', { force: true });
  await p.click('.scenario[data-id=matrix]', { force: true }); await p.click('#confirmKeep', { force: true });
  for (const [k, t] of [[0, 0.8], [1, 1.6], [2, 2.6], [3, 6]].entries()) { await run(k === 0 ? t[1] : t[1] - [0.8, 1.6, 2.6, 6][k - 1]); await shot(`tools/mx-${k}.png`); }
  console.log('errors', errs.length, errs.slice(0, 3));
  await b.close();
})();
