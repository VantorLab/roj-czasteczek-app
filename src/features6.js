
/* ============================================================
   DORADCA AI — analyses what you drop in, proposes and applies a whole
   design, learns from ratings and A/B wins, and distils lessons.
   Engine: Claude in the claude.ai viewer (window.claude "sample"), or an
   Anthropic API key in the desktop / phone app. Memory: shared artifact db
   (team-wide) or this device's storage.
   ============================================================ */
const AI = { sample: null, db: null, user: null, uid: null, mode: 'none', recipes: [], votes: {}, myVotes: {}, lessons: [], current: null, ctl: null, ideas: [] };

/* ---------- engine ---------- */
(async () => {
  if (window.claude?.use) {
    try { AI.sample = await window.claude.use('sample'); } catch {}
    try { AI.db = await window.claude.use('db'); } catch {}
    try { AI.user = await window.claude.use('user'); AI.uid = AI.user ? await AI.user.id() : null; } catch {}
  }
  AI.mode = AI.sample ? 'claude' : (apiKey() ? 'key' : 'none');
  aiEngineUI();
  memoryInit();
})();
function apiKey() { try { return localStorage.getItem('roj-anthropic-key') || ''; } catch { return ''; } }
function aiEngineUI() {
  const st = $('aiEngine');
  st.textContent = AI.mode === 'claude' ? 'Claude (Twoje konto)' : AI.mode === 'key' ? 'Claude przez klucz API' : 'niepodłączony';
  $('aiKeyBox').hidden = AI.mode === 'claude';
  ['aiGo', 'aiChatGo', 'aiDistill'].forEach(id => $(id).disabled = AI.mode === 'none');
  $('aiMem').textContent = AI.db ? 'wspólna pamięć zespołu' : 'pamięć tego urządzenia';
}
$('aiKeySave').onclick = () => {
  const k = $('aiKey').value.trim();
  try { if (k) localStorage.setItem('roj-anthropic-key', k); else localStorage.removeItem('roj-anthropic-key'); } catch {}
  AI.mode = AI.sample ? 'claude' : (k ? 'key' : 'none'); $('aiKey').value = ''; aiEngineUI(); toast(k ? 'Klucz zapisany na tym urządzeniu' : 'Klucz usunięty');
};

let SDK = null;
async function askJSON(prompt, image = null, signal) {
  if (AI.mode === 'claude') {
    const opts = { signal, cache: false }; if (image) opts.images = [image];
    return AI.sample.json(prompt, opts);
  }
  if (AI.mode === 'key') {
    SDK ??= (await import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.0.0/+esm')).default;
    const client = new SDK({ apiKey: apiKey(), dangerouslyAllowBrowser: true });
    const content = [];
    if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await blobToB64(image) } });
    content.push({ type: 'text', text: prompt });
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5', max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'medium' }, messages: [{ role: 'user', content }]
    }, { signal });
    if (res.stop_reason === 'refusal') throw { code: 'refused', message: 'Claude odmówił tej prośby' };
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return parseLooseJSON(text);
  }
  throw { code: 'not_granted', message: 'AI niepodłączone' };
}
function parseLooseJSON(t) {
  try { return JSON.parse(t); } catch {}
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) { try { return JSON.parse(f[1]); } catch {} }
  const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw { code: 'invalid_json', message: 'Odpowiedź nie była poprawnym JSON-em' };
}
const blobToB64 = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(b); });
function aiErr(e) {
  const c = e?.code;
  const m = { not_granted: 'Nie pozwolono na użycie Claude. Włącz to w uprawnieniach strony.', rate_limited: 'Za dużo zapytań lub limit konta — spróbuj za chwilę.', refused: 'Claude odmówił tej prośby. Zmień zdjęcie lub opis.', invalid_json: 'AI odpowiedziało w złym formacie. Spróbuj ponownie.', cancelled: 'Zatrzymano.', image_rejected: 'Zdjęcie odrzucone (za duże lub zły format).', session_expired: 'Zaloguj się ponownie do Claude.' };
  return m[c] || (e?.status === 401 ? 'Klucz API jest nieprawidłowy.' : 'AI chwilowo niedostępne: ' + (e?.message || c || e));
}

/* ---------- memory: recipes, votes, lessons ---------- */
const MEM_KEY = 'roj-ai-memory';
function localMem() { try { return JSON.parse(localStorage.getItem(MEM_KEY) || '{"recipes":[],"votes":{},"lessons":[]}'); } catch { return { recipes: [], votes: {}, lessons: [] }; } }
function saveLocalMem(m) { try { localStorage.setItem(MEM_KEY, JSON.stringify(m)); } catch {} }
function memoryInit() {
  if (AI.db) {
    AI.db.collection('recipes').orderBy('at', 'desc').limit(300).onSnapshot(s => { AI.recipes = s.docs.map(d => ({ id: d.id, ...d.data() })); renderMemory(); }, () => {});
    AI.db.collection('votes').onSnapshot(s => {
      const agg = {}; s.docs.forEach(d => { const m = d.data().map || {}; for (const [k, v] of Object.entries(m)) agg[k] = (agg[k] || 0) + Number(v || 0); if (d.id === AI.uid) AI.myVotes = { ...m }; });
      AI.votes = agg; renderMemory();
    }, () => {});
    AI.db.doc('knowledge/lessons').onSnapshot(d => { AI.lessons = d.exists ? (d.data().items || []) : []; renderMemory(); }, () => {});
  } else {
    const m = localMem(); AI.recipes = m.recipes; AI.votes = m.votes; AI.myVotes = m.votes; AI.lessons = m.lessons; renderMemory();
  }
}
async function saveRecipe(r) {
  r.at = Date.now(); r.by = AI.uid || 'local';
  if (AI.db) { try { const ref = await AI.db.collection('recipes').add(r); return ref.id; } catch { toast('Nie udało się zapisać przepisu we wspólnej pamięci'); return null; } }
  const m = localMem(); r.id = 'r' + Date.now(); m.recipes.unshift(r); m.recipes = m.recipes.slice(0, 300); saveLocalMem(m); AI.recipes = m.recipes; renderMemory(); return r.id;
}
async function vote(val) {
  const id = AI.current; if (!id) { toast('Najpierw niech Doradca coś zaproponuje'); return; }
  AI.myVotes[id] = val;
  if (AI.db && AI.uid) { try { await AI.db.doc('votes/' + AI.uid).set({ map: AI.myVotes, at: Date.now() }); } catch { toast('Ocena nie zapisała się (brak uprawnień do zapisu?)'); return; } }
  else { const m = localMem(); m.votes[id] = val; saveLocalMem(m); AI.votes = m.votes; renderMemory(); }
  toast(val > 1 ? 'Zapamiętane: ten wariant wygrał test' : val > 0 ? 'Zapamiętane: podoba się' : 'Zapamiętane: unikać');
  AI.rateCount = (AI.rateCount || 0) + 1;
  if (AI.rateCount % 5 === 0 && AI.mode !== 'none') distill();       // every 5th rating: learn new lessons
}
$('aiUp').onclick = () => vote(1); $('aiDown').onclick = () => vote(-1); $('aiWin').onclick = () => vote(2);
function scored() { return AI.recipes.map(r => ({ ...r, score: AI.votes[r.id] || 0 })); }
function renderMemory() {
  const s = scored(), rated = s.filter(r => r.score !== 0).length;
  $('aiStats').textContent = `${AI.recipes.length} przepisów · ${rated} ocenionych · ${AI.lessons.length} lekcji`;
  $('aiLessons').innerHTML = AI.lessons.length ? AI.lessons.map(l => `<li>${escapeHtml(l.text)}</li>`).join('') : '<li class="note">Jeszcze brak lekcji. Oceniaj wyniki, a po 5 ocenach Doradca sam wyciągnie wnioski.</li>';
}
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- what the AI may change ---------- */
const AI_KEYS = ['fxMode', 'trans', 'camMove', 'bg', 'additive', 'colorMode', 'tint1', 'tint2', 'bloom', 'size', 'opacity', 'noise', 'wave', 'flight', 'morphTime',
  'reliefH', 'reliefShade', 'voxCount', 'fluidOn', 'fluidColor', 'fluidAuto', 'sweepAmt', 'sweepEvery', 'tilt', 'grain', 'vignette', 'chroma', 'retroMode', 'retroMono',
  'resinOn', 'resinColor', 'ovOn', 'ovTitle', 'ovSub', 'ovCta', 'ovPos', 'ovColor', 'ovCtaBg', 'frame', 'seqTail', 'bgMode'];
function controlSpec() {
  return AI_KEYS.map(id => {
    const el = $(id); if (!el) return null;
    if (el.tagName === 'SELECT') return `${id}: jedno z [${[...el.options].map(o => o.value).join(', ')}]`;
    if (el.type === 'checkbox') return `${id}: true/false`;
    if (el.type === 'range') return `${id}: liczba ${el.min}–${el.max}`;
    if (el.type === 'color') return `${id}: kolor #rrggbb`;
    return `${id}: tekst (krótki, po polsku)`;
  }).filter(Boolean).join('\n');
}
function currentConfig() { return Object.fromEntries(AI_KEYS.filter(id => $(id)).map(id => [id, getCtl(id)])); }
function applyConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return;
  for (const [id, v] of Object.entries(cfg.controls || {})) {
    if (!AI_KEYS.includes(id)) continue;
    const el = $(id); if (!el) continue;
    if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === String(v))) continue;
    if (el.type === 'range') { const n = Math.min(+el.max, Math.max(+el.min, Number(v))); if (!isFinite(n)) continue; setCtl(id, n); }
    else if (el.type === 'color') { if (/^#[0-9a-f]{6}$/i.test(String(v))) setCtl(id, v); }
    else setCtl(id, el.type === 'checkbox' ? !!v : String(v).slice(0, 60));
  }
  if ('fxMode' in (cfg.controls || {})) setMode($('fxMode').value);
  if ($('resinOn').checked) setResinTarget($('resinColor').value);
  if (Array.isArray(cfg.steps) && cfg.steps.length) {
    const ok = cfg.steps.filter(s => s && ACTS[s.act] && isFinite(+s.t)).slice(0, 16).map(s => ({ t: Math.max(0, Math.min(60, +s.t)), act: s.act, arg: s.arg == null ? '' : String(s.arg) }));
    ok.forEach(s => { if (s.act === 'goto') s.arg = String(Math.min(shapes.length - 1, Math.max(0, parseInt(s.arg) || 0))); });
    if (ok.length) { steps = ok; renderSteps(); }
  }
  applyLook(); applyTrans();
}

/* ---------- prompts ---------- */
function memoryBrief() {
  const s = scored().filter(r => r.score !== 0).sort((a, b) => b.score - a.score);
  const best = s.filter(r => r.score > 0).slice(0, 6).map(r => `+${r.score} | ${r.subject} | ${r.summary} | ${JSON.stringify(r.config?.controls || {}).slice(0, 380)}`);
  const worst = s.filter(r => r.score < 0).slice(-3).map(r => `${r.score} | ${r.subject} | ${r.summary}`);
  return `LEKCJE (wyciągnięte z wcześniejszych ocen):\n${AI.lessons.map(l => '- ' + l.text).join('\n') || '- brak'}\n\nNAJLEPIEJ OCENIANE PRZEPISY:\n${best.join('\n') || '- brak'}\n\nŹLE OCENIANE (unikaj):\n${worst.join('\n') || '- brak'}`;
}
const ACT_SPEC = () => `Dostępne kroki osi czasu (act): ${Object.keys(ACTS).join(', ')}. arg: goto→numer kształtu od 0 (jest ${shapes.length}: ${shapes.map((s, i) => i + '=' + s.name).join(', ')}); reform→cloud|pour|floor; trans→0..4; effect→particles|relief|voxels|glass; resin→kolor #rrggbb; retro→0..5; pozostałe bez arg.`;
function designPrompt(goal) {
  return `Jesteś art directorem aplikacji "Rój Cząsteczek", która zamienia zdjęcie produktu w krótkie wideo reklamowe (cząsteczki, relief 3D, klocki z fizyką, rozbite szkło, płyn, światło kinowe, retro).
Na załączonym obrazie jest materiał od użytkownika. Cel użytkownika: "${goal || 'krótka, efektowna rolka reklamowa na Instagram'}".

Zadanie: rozpoznaj, co jest na obrazie (produkt, branża, nastrój, kolory), i zaprojektuj najlepszy efekt i sekwencję ~12–15 s. Napisz polskie, krótkie teksty reklamowe (tytuł max 30 znaków, podtytuł z ceną tylko jeśli ją znasz — inaczej korzyść, CTA max 20 znaków). Jeśli to mebel/stół z żywicą epoksydową, rozważ kolor żywicy (resinOn, resinColor) i efekt relief lub połysk.
Ucz się z pamięci poniżej: powtarzaj to, co ludzie oceniali dobrze, unikaj tego, co oceniali źle.

${memoryBrief()}

Ustawienia, które możesz zmienić (tylko te klucze):
${controlSpec()}
${ACT_SPEC()}

Odpowiedz WYŁĄCZNIE jednym obiektem JSON:
{"subject":"co to jest (3-6 słów)","summary":"jednym zdaniem, jaki styl wybrałeś i dlaczego","controls":{...},"steps":[{"t":0,"act":"reform","arg":"cloud"},...],"ideas":[{"title":"krótko","why":"jedno zdanie","controls":{...},"steps":[...]}, 2 inne pomysły o wyraźnie innym charakterze]}`;
}
function tweakPrompt(msg) {
  return `Jesteś art directorem aplikacji "Rój Cząsteczek". Obecne ustawienia: ${JSON.stringify(currentConfig())}
Obecna oś czasu: ${JSON.stringify(steps)}
Prośba użytkownika: "${msg}"
${memoryBrief()}
Dozwolone klucze:
${controlSpec()}
${ACT_SPEC()}
Odpowiedz WYŁĄCZNIE JSON-em: {"reply":"1–2 zdania po polsku, co zmieniłeś","controls":{tylko zmienione},"steps":[cała nowa oś czasu albo pominięte, jeśli bez zmian],"summary":"jednym zdaniem styl po zmianie"}`;
}
function distillPrompt() {
  const rows = scored().filter(r => r.score !== 0).slice(0, 60).map(r => `${r.score > 0 ? '+' : ''}${r.score} | ${r.subject} | ${r.summary} | ${JSON.stringify(r.config?.controls || {}).slice(0, 300)}`);
  return `Poniżej oceny przepisów (ustawień) z aplikacji do reklamowych wideo z cząsteczkami (+ dobre, 2 = wygrał test A/B, − złe).
${rows.join('\n')}
Dotychczasowe lekcje: ${JSON.stringify(AI.lessons)}
Wyciągnij 4–10 konkretnych, praktycznych lekcji (po polsku, każda max 140 znaków), np. "Dla stołów z żywicą: relief + połysk co 4 s, czarne tło, bez świecenia". Łącz z dotychczasowymi, usuwaj sprzeczne z nowymi danymi.
Odpowiedz WYŁĄCZNIE JSON-em: {"lessons":[{"text":"..."}]}`;
}

/* ---------- actions ---------- */
function setBusyAI(on, msg) { $('aiStatus').textContent = msg || ''; $('aiStop').hidden = !on; ['aiGo', 'aiChatGo', 'aiDistill'].forEach(id => $(id).disabled = on || AI.mode === 'none'); }
$('aiStop').onclick = () => AI.ctl?.abort();
async function shapeImageBlob(i) {
  const src = shapeCanvas(i), [w, h] = sizeFor(src, 1024);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, w, h); x.drawImage(src, 0, 0, w, h);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
}
$('aiFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; await loadImageToShape(0, f); fromIdx = toIdx = 0; uploadPair(); toast('Wczytano. Kliknij „Zaproponuj i zastosuj”.'); };
$('aiGo').onclick = async () => {
  AI.ctl = new AbortController(); setBusyAI(true, 'Analizuję obraz i projektuję… (zwykle 10–60 s)');
  try {
    const i = firstImageIdx(), img = await shapeImageBlob(i);
    const r = await askJSON(designPrompt($('aiGoal').value.trim()), img, AI.ctl.signal);
    applyConfig(r); AI.ideas = Array.isArray(r.ideas) ? r.ideas.slice(0, 3) : [];
    AI.current = await saveRecipe({ subject: String(r.subject || '').slice(0, 80), summary: String(r.summary || '').slice(0, 240), goal: $('aiGoal').value.slice(0, 200), config: { controls: r.controls || {}, steps: r.steps || [] } });
    $('aiStatus').innerHTML = `<b>${escapeHtml(r.subject || '')}</b> — ${escapeHtml(r.summary || '')}`;
    renderIdeas(); reform('cloud'); playSeq();
  } catch (e) { $('aiStatus').textContent = aiErr(e); }
  finally { $('aiStop').hidden = true; ['aiGo', 'aiChatGo', 'aiDistill'].forEach(id => $(id).disabled = AI.mode === 'none'); }
};
function renderIdeas() {
  $('aiIdeas').innerHTML = AI.ideas.map((d, k) => `<button type="button" class="idea" data-k="${k}"><b>${escapeHtml(d.title || 'Pomysł ' + (k + 1))}</b><span>${escapeHtml(d.why || '')}</span></button>`).join('');
}
$('aiIdeas').onclick = async e => {
  const b = e.target.closest('.idea'); if (!b) return; const d = AI.ideas[+b.dataset.k]; if (!d) return;
  applyConfig(d); AI.current = await saveRecipe({ subject: String(d.title || '').slice(0, 80), summary: String(d.why || '').slice(0, 240), config: { controls: d.controls || {}, steps: d.steps || [] } });
  reform('cloud'); playSeq(); toast('Zastosowano: ' + (d.title || 'pomysł'));
};
$('aiChatGo').onclick = async () => {
  const msg = $('aiChat').value.trim(); if (!msg) return;
  AI.ctl = new AbortController(); setBusyAI(true, 'Wprowadzam poprawki…');
  try {
    const r = await askJSON(tweakPrompt(msg), null, AI.ctl.signal);
    applyConfig(r); $('aiChat').value = '';
    AI.current = await saveRecipe({ subject: 'poprawka: ' + msg.slice(0, 60), summary: String(r.summary || r.reply || '').slice(0, 240), config: { controls: currentConfig(), steps } });
    $('aiStatus').textContent = r.reply || 'Gotowe.'; playSeq();
  } catch (e) { $('aiStatus').textContent = aiErr(e); }
  finally { $('aiStop').hidden = true; ['aiGo', 'aiChatGo', 'aiDistill'].forEach(id => $(id).disabled = AI.mode === 'none'); }
};
async function distill() {
  if (!scored().some(r => r.score !== 0)) { toast('Najpierw oceń kilka wyników'); return; }
  AI.ctl = new AbortController(); setBusyAI(true, 'Uczę się z ocen…');
  try {
    const r = await askJSON(distillPrompt(), null, AI.ctl.signal);
    const items = (r.lessons || []).map(l => ({ text: String(l.text || l).slice(0, 160) })).filter(l => l.text).slice(0, 10);
    if (!items.length) throw { code: 'invalid_json' };
    if (AI.db) await AI.db.doc('knowledge/lessons').set({ items, at: Date.now() });
    else { const m = localMem(); m.lessons = items; saveLocalMem(m); AI.lessons = items; renderMemory(); }
    $('aiStatus').textContent = `Nauczyłem się ${items.length} lekcji. Użyję ich przy kolejnych projektach.`;
  } catch (e) { $('aiStatus').textContent = aiErr(e); }
  finally { $('aiStop').hidden = true; ['aiGo', 'aiChatGo', 'aiDistill'].forEach(id => $(id).disabled = AI.mode === 'none'); }
}
$('aiDistill').onclick = distill;
