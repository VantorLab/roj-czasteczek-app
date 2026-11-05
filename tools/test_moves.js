// Screenshots of each new move at exact simulation times (fake clock, frame by frame).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8769/index.html'); await p.waitForTimeout(3000);
  await p.selectOption('#bgMode', 'none'); await p.setInputFiles('.shape input[type=file] >> nth=0', 'tools/stol.jpg'); await p.waitForTimeout(1500);
  await p.click('#tabs button[data-tab=look]'); await p.uncheck('#additive'); await p.uncheck('#autoPerf'); await p.selectOption('#bg', 'black');
  await p.click('#tabs button[data-tab=seq]');
  const cdp = await p.context().newCDPSession(p);
  const shot = async path => { const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 740, height: 720, scale: 0.5 } }); require('fs').writeFileSync(path, Buffer.from(data, 'base64')); };
  await p.clock.install(); await p.waitForTimeout(300); await p.clock.pauseAt(Date.now() + 1000);
  const run = async sec => { for (let i = 0; i < Math.round(sec * 30); i++) await p.clock.runFor(1000 / 30); };
  // [scenario, [sim seconds at which to shoot]]
  const plan = { tornado: [3.2, 5.0, 9.5], implode: [3.2, 4.4, 5.2, 9.0], blow: [3.2, 5.0, 6.8, 10.5], scan: [1.3, 2.3, 3.6], fireworks: [3.2, 4.3, 5.5, 9.0] };
  for (const [id, times] of Object.entries(plan)) {
    await p.click(`.scenario[data-id=${id}]`, { force: true }); await p.click('#confirmKeep', { force: true });
    let t = 0;
    for (const [k, at] of times.entries()) { await run(at - t); t = at; await shot(`tools/mv-${id}-${k}.png`); }
    console.log(id, 'ok');
  }
  console.log('errors', errs.length, errs.slice(0, 3));
  await b.close();
})();
