// Records the tutorial video from the real app: captions, title cards and a visible cursor are injected.
// Usage: serve app/ on :8769, then `node tools/make_tutorial.js` → tools/tutorial-raw/*.webm
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: path.join(__dirname, 'tutorial-raw'), size: { width: 1280, height: 720 } } });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    // example answer for the AI scene (the real app asks Claude here)
    const sample = async () => ({ text: '' });
    sample.json = async () => { await new Promise(r => setTimeout(r, 1500)); return { subject: 'stół z żywicą epoksydową', summary: 'Relief 3D na czarnym tle z połyskiem i napisami w złocie.', controls: { fxMode: 'relief', bg: 'black', additive: false, sweepEvery: 3, ovOn: true, ovTitle: 'Stół Burl & Żywica', ovSub: 'Ręcznie robiony · od 6 900 zł', ovCta: 'Zamów wycenę', bloom: 0.3 }, steps: [{ t: 0, act: 'reform', arg: 'cloud' }, { t: 3, act: 'sweep' }], ideas: [{ title: 'Klocki z deszczem', why: 'Dynamiczny start, dobry hak w 1. sekundzie' }, { title: 'Druk retro', why: 'Wyróżnia się w feedzie' }] }; };
    window.claude = { use: async n => n === 'sample' ? sample : null };
    addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = `#tCap{pointer-events:none;position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:99;max-width:86%;background:rgba(4,18,26,.92);color:#fff;font:600 22px/1.35 Manrope,Segoe UI,sans-serif;padding:12px 22px;border-radius:14px;border:1px solid #8ff3e6;text-align:center;transition:opacity .3s}
      #tCap small{display:block;font-weight:500;font-size:15px;color:#8ff3e6;margin-top:3px}
      #tCard{position:fixed;inset:0;z-index:100;display:grid;place-content:center;gap:14px;text-align:center;background:radial-gradient(circle at 50% 40%,#0d3542,#04121a 70%);color:#fff;font-family:'Bricolage Grotesque',Segoe UI,sans-serif;transition:opacity .5s}
      #tCard h1{font-size:64px;margin:0;letter-spacing:-.02em} #tCard p{font:500 24px Manrope,sans-serif;color:#8ff3e6;margin:0} #tCard .s{font-size:18px;color:#dcefee}
      #tCur{position:fixed;z-index:101;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(255,155,122,.35);border:2px solid #ff9b7a;pointer-events:none;transition:transform .12s}
      #tCur.down{transform:scale(.6);background:rgba(255,155,122,.8)}`;
      document.head.appendChild(st);
      const cap = document.createElement('div'); cap.id = 'tCap'; cap.style.opacity = 0; document.body.appendChild(cap);
      const card = document.createElement('div'); card.id = 'tCard'; card.style.opacity = 0; card.style.pointerEvents = 'none'; document.body.appendChild(card);
      const cur = document.createElement('div'); cur.id = 'tCur'; document.body.appendChild(cur);
      addEventListener('mousemove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
      addEventListener('mousedown', () => cur.classList.add('down'), true); addEventListener('mouseup', () => cur.classList.remove('down'), true);
    });
  });
  const cap = (t, s = '') => p.evaluate(([t, s]) => { const c = document.getElementById('tCap'); c.innerHTML = t + (s ? `<small>${s}</small>` : ''); c.style.opacity = t ? 1 : 0; }, [t, s]);
  const card = (html) => p.evaluate(h => { const c = document.getElementById('tCard'); if (h) { c.innerHTML = h; c.style.opacity = 1; } else c.style.opacity = 0; }, html);
  const wait = ms => p.waitForTimeout(ms);
  let mx = 640, my = 360;
  const moveTo = async (sel) => { const bb = await (await p.$(sel)).boundingBox(); const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2; await p.mouse.move(x, y, { steps: 18 }); mx = x; my = y; await wait(200); };
  const click = async sel => { await moveTo(sel); await p.mouse.down(); await wait(120); await p.mouse.up(); await p.click(sel, { force: true }).catch(() => {}); };
  const tab = t => click(`#tabs button[data-tab=${t}]`);

  await p.goto('http://localhost:8769/index.html');
  await card('<h1>Rój Cząsteczek</h1><p>Instrukcja w 2 minuty</p><p class="s">Zdjęcie produktu → efektowne wideo reklamowe</p>');
  await wait(4500); await card(''); await p.mouse.move(640, 360);

  // 1. upload
  await cap('1. Wgraj zdjęcie produktu', 'Kształty → Wgraj (albo przeciągnij plik na scenę)');
  await moveTo('.shape .file-btn'); await p.setInputFiles('.shape input[type=file] >> nth=0', path.join(__dirname, 'stol.jpg'));
  await click('#tabs button[data-tab=look]'); await p.uncheck('#additive'); await p.uncheck('#autoPerf');
  await click('#tabs button[data-tab=shapes]'); await p.selectOption('#bgMode', 'none');
  await wait(4500);

  // 2. AI advisor
  await cap('2. Najszybciej: Doradca AI zrobi to za Ciebie', 'Wpisz cel i kliknij „Zaproponuj i zastosuj”');
  await tab('ai'); await moveTo('#aiGoal'); await p.type('#aiGoal', 'rolka na Instagram, luksusowo, cena 6900 zł', { delay: 35 });
  await click('#aiGo'); await wait(2500);
  await cap('Doradca dobiera efekt, kolory, napisy i sekwencję', 'Pasek na dole: Gotowe zostawia zmianę, Anuluj ją cofa');
  await wait(5000);
  await click('#confirmKeep'); await wait(1200);
  await cap('Oceniaj wyniki, a Doradca będzie się uczył', 'Podoba się / Nie podoba się / Wygrał test A/B');
  await moveTo('#aiUp'); await wait(2500);

  // 3. effects
  await cap('3. Efekty: relief 3D, klocki, szkło, płyn, retro', 'Przeciągnij obraz myszą, żeby go obrócić');
  await tab('fx'); await wait(800);
  await p.mouse.move(420, 380, { steps: 10 }); await p.mouse.down(); await p.mouse.move(530, 340, { steps: 25 }); await p.mouse.up(); await wait(1800);
  await p.mouse.down(); await p.mouse.move(420, 380, { steps: 25 }); await p.mouse.up(); await wait(1200);
  await p.selectOption('#fxMode', 'voxels'); await wait(300); await p.selectOption('#voxCount', '4000'); await wait(8000);
  await cap('Spacja rozsypuje obiekt', 'Klocki spadają z fizyką i wracają na miejsce');
  await p.keyboard.press(' '); await wait(3500);
  await p.selectOption('#fxMode', 'relief'); await wait(1500);

  // 4. resin colours
  await cap('4. Stoły z żywicą: zmień kolor żywicy', 'Kształty → Kolor żywicy — drewno zostaje bez zmian');
  await tab('shapes'); await p.evaluate(() => document.getElementById('resinOn').scrollIntoView({ block: 'center' }));
  await click('#resinOn'); await wait(800);
  for (const c of ['Turkus', 'Bursztyn', 'Szmaragd']) { await click(`#resinSwatches button[title=${c}]`); await wait(1800); }

  // 5. brand + frame
  await cap('5. Marka i format', 'Marka: tytuł, cena, przycisk, logo · Eksport: 9:16 dla rolek');
  await tab('brand'); await wait(1500); await tab('export'); await p.selectOption('#frame', '9:16'); await wait(3000);

  // 6. sequence
  await cap('6. Sekwencja: gotowe szablony i ruch kamery', 'P odtwarza sekwencję, Esc zatrzymuje');
  await tab('seq'); await click('#btnSeqPhoto'); await click('#confirmKeep'); await p.selectOption('#camMove', 'dolly');
  await click('#btnPlay'); await wait(7000); await p.keyboard.press('Escape');

  // 7. export
  await cap('7. Eksport: Renderuj MP4 (Ctrl+Enter)', 'Idealnie płynne wideo z napisami i muzyką → Zapisz wideo');
  await tab('export'); await moveTo('#btnRender'); await wait(2500);

  // 8. undo + shortcuts
  await cap('Pomyłka? Ctrl+Z cofa, Ctrl+Y ponawia', 'Znak zapytania (?) pokazuje wszystkie skróty');
  await p.keyboard.press('Shift+Slash'); await wait(3500); await p.keyboard.press('Escape'); await wait(500);

  await cap('');
  await card('<h1>Gotowe!</h1><p>Windows · iPhone · online w Claude</p><p class="s">github.com/VantorLab/roj-czasteczek-app</p><p class="s">Instrukcja: docs/INSTRUKCJA.md</p>');
  await wait(4500);
  await p.close(); await ctx.close(); await b.close();
  console.log('recorded');
})();
