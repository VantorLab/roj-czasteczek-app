// Simulates phone tilt (deviceorientation) and checks the view turns and comes back without drift.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8769/index.html'); await p.waitForTimeout(3000);
  await p.setInputFiles('.shape input[type=file] >> nth=0', 'tools/stol.jpg'); await p.waitForTimeout(1500);
  await p.click('#tabs button[data-tab=fx]'); await p.selectOption('#fxMode', 'relief'); await p.waitForTimeout(2500);
  await p.click('#tabs button[data-tab=motion]'); await p.check('#parallaxOn');
  const tilt = (beta, gamma) => p.evaluate(([b, g]) => { for (let i = 0; i < 6; i++) setTimeout(() => dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: b, gamma: g })), i * 60); }, [beta, gamma]);
  await tilt(45, 0); await p.waitForTimeout(800); await p.screenshot({ path: 'tools/par-0.png' });
  await tilt(45, 25); await p.waitForTimeout(1500); await p.screenshot({ path: 'tools/par-right.png' });
  await tilt(30, -25); await p.waitForTimeout(1500); await p.screenshot({ path: 'tools/par-left-up.png' });
  await tilt(45, 0); await p.waitForTimeout(2000); await p.screenshot({ path: 'tools/par-back.png' });
  console.log('errors', errs.length, errs.slice(0, 3));
  await b.close();
})();
