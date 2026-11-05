// Checks undo/redo, the confirm bar and keyboard shortcuts (AI mocked).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    const sample = async () => ({ text: 'x' });
    sample.json = async () => { await new Promise(r => setTimeout(r, 200)); return { subject: 'test', summary: 'test', controls: { fxMode: 'relief', bg: 'black', bloom: 2, ovOn: true, ovTitle: 'AI tytuł' }, steps: [{ t: 0, act: 'reform', arg: 'pour' }], ideas: [] }; };
    window.claude = { use: async n => n === 'sample' ? sample : null };
  });
  await p.goto('http://localhost:8769/index.html'); await p.waitForTimeout(4000);
  const val = id => p.$eval('#' + id, e => e.type === 'checkbox' ? e.checked : e.value);
  const log = async l => console.log(l, '| bloom', await val('bloom'), 'bg', await val('bg'), 'fx', await val('fxMode'), 'title', await val('ovTitle'), 'steps', await p.$$eval('.step', r => r.length), 'undo', !(await p.$eval('#histUndo', e => e.disabled)));
  await log('start');
  // 1) slider change -> Ctrl+Z -> Ctrl+Y
  await p.click('#tabs button[data-tab=look]');
  await p.$eval('#bloom', el => { el.value = 1.8; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(700); await log('after bloom 1.8');
  await p.click('canvas.gl', { position: { x: 50, y: 50 } });
  await p.keyboard.press('Control+z'); await p.waitForTimeout(500); await log('after Ctrl+Z');
  await p.keyboard.press('Control+y'); await p.waitForTimeout(500); await log('after Ctrl+Y');
  // 2) AI proposal -> confirm bar -> Anuluj
  await p.click('#tabs button[data-tab=ai]'); await p.click('#aiGo'); await p.waitForTimeout(1500);
  console.log('confirm bar visible:', !(await p.$eval('#confirmBar', e => e.hidden)), await p.$eval('#confirmText', e => e.textContent));
  await log('after AI');
  await p.click('#confirmCancel'); await p.waitForTimeout(800); await log('after Anuluj');
  // 3) AI again -> Gotowe via Enter -> then Ctrl+Z still reverts it
  await p.click('#aiGo'); await p.waitForTimeout(1500); await p.click('canvas.gl', { position: { x: 50, y: 50 } }); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  console.log('bar hidden after Enter:', await p.$eval('#confirmBar', e => e.hidden)); await log('kept');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(800); await log('Ctrl+Z after Gotowe');
  // 4) shortcuts: ? help, Esc, H hide panel, P play, Esc stop
  await p.keyboard.press('Shift+Slash'); await p.waitForTimeout(300); console.log('help open:', !(await p.$eval('#keysModal', e => e.hidden)), 'rows', await p.$$eval('#keysList dt', r => r.length));
  await p.screenshot({ path: 'tools/shot-keys.png' });
  await p.keyboard.press('Escape'); console.log('help closed:', await p.$eval('#keysModal', e => e.hidden));
  await p.keyboard.press('h'); await p.waitForTimeout(400); console.log('panel hidden:', await p.$eval('.app', e => e.classList.contains('panel-hidden')));
  await p.screenshot({ path: 'tools/shot-hidden.png' });
  await p.keyboard.press('h');
  await p.keyboard.press('p'); await p.waitForTimeout(300); await p.keyboard.press('Escape');
  console.log('errors', errs.length, errs.slice(0, 3));
  await b.close();
})();
