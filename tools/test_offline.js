// Loads app/index.html with every CDN blocked, to prove the Windows/iPhone app runs offline.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const vp of [{ width: 1280, height: 800, name: 'desktop' }, { width: 390, height: 844, name: 'iphone' }]) {
    const p = await b.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errs = [], blocked = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route(/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/, r => { blocked.push(r.request().url().slice(0, 70)); r.abort(); });
    await p.goto('http://localhost:8768/index.html');
    await p.waitForTimeout(6000);
    await p.screenshot({ path: `../shots-app-${vp.name}.png` });
    const info = await p.evaluate(() => ({ count: document.getElementById('hudCount').textContent, fps: document.getElementById('hudFps').textContent, manifest: !!document.querySelector('link[rel=manifest]'), keybox: !document.getElementById('aiKeyBox').hidden, engine: document.getElementById('aiEngine').textContent, overflow: document.documentElement.scrollWidth > innerWidth }));
    console.log(vp.name, JSON.stringify(info), '| blocked requests:', blocked.length, '| errors:', errs.length, errs.slice(0, 2));
    await p.close();
  }
  await b.close();
})();
