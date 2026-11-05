
/* ============================================================
   UNDO / REDO · confirm bar (Gotowe / Anuluj) · keyboard shortcuts
   History covers every setting in the panel, the timeline and the main effect.
   ============================================================ */
const hist = { undo: [], redo: [], cur: null, restoring: false, timer: null, before: null };
function histSnap() { return JSON.stringify({ c: Object.fromEntries(controlIds().map(id => [id, getCtl(id)])), s: steps, m: FX.mode }); }
function histCommit() {
  clearTimeout(hist.timer); hist.timer = null;
  if (hist.restoring) return;
  const s = histSnap(); if (s === hist.cur) return;
  if (hist.cur) { hist.undo.push(hist.cur); if (hist.undo.length > 120) hist.undo.shift(); }
  hist.cur = s; hist.redo.length = 0; histUI();
}
function histTouch() { if (hist.restoring) return; clearTimeout(hist.timer); hist.timer = setTimeout(histCommit, 400); }
function histRestore(s) {
  hist.restoring = true;
  try {
    const o = JSON.parse(s);
    steps = o.s; renderSteps(); applyControls(o.c); setMode(o.m);
    if ($('resinOn').checked) setResinTarget($('resinColor').value);
  } finally { setTimeout(() => { hist.restoring = false; hist.cur = histSnap(); histUI(); }, 0); }
}
function undo() {
  if (hist.timer) histCommit();
  if (!hist.undo.length) { toast('Nie ma czego cofnąć'); return; }
  hist.redo.push(hist.cur); histRestore(hist.undo.pop()); toast('Cofnięto');
}
function redo() {
  if (!hist.redo.length) { toast('Nie ma czego ponowić'); return; }
  hist.undo.push(hist.cur); histRestore(hist.redo.pop()); toast('Ponowiono');
}
function histUI() { $('histUndo').disabled = !hist.undo.length && !hist.timer; $('histRedo').disabled = !hist.redo.length; }
// record every change made in the panel (typing, sliders, selects, checkboxes)…
['input', 'change'].forEach(ev => document.querySelector('.panel').addEventListener(ev, e => { if (!e.target.closest('#aiKeyBox')) histTouch(); }, true));
// …and changes made in code: timeline edits and effect switches
{ const rs = renderSteps; renderSteps = function () { rs(); histTouch(); }; }
{ const sm = setMode; setMode = function (m) { sm(m); histTouch(); }; }
$('histUndo').onclick = undo; $('histRedo').onclick = redo;

/* ---------- confirm bar for big automatic changes ---------- */
function histBegin(label) {
  if (hist.timer) histCommit();
  hist.before = hist.cur;
  $('confirmText').textContent = label; $('confirmBar').hidden = false;
}
function confirmKeep() { $('confirmBar').hidden = true; hist.before = null; if (hist.timer) histCommit(); }
function confirmCancel() {
  $('confirmBar').hidden = true;
  AI?.ctl?.abort?.();
  if (hist.before) { if (hist.timer) histCommit(); if (hist.cur !== hist.before) { hist.undo.push(hist.cur); histRestore(hist.before); } toast('Anulowano zmianę'); }
  hist.before = null;
}
$('confirmKeep').onclick = confirmKeep; $('confirmCancel').onclick = confirmCancel;
const BEGIN = [['#aiGo', 'Propozycja Doradcy AI'], ['#aiChatGo', 'Poprawka Doradcy AI'], ['.idea', 'Pomysł Doradcy AI'], ['#btnSeqDefault', 'Domyślna sekwencja'], ['#btnSeqPhoto', 'Szablon: zdjęcie → rój'], ['#btnSeqResin', 'Szablon: kolory żywicy']];
document.querySelector('.panel').addEventListener('click', e => { for (const [sel, label] of BEGIN) if (e.target.closest(sel)) { histBegin(label + ' — zostawić?'); break; } }, true);
$('preset').addEventListener('change', () => { if ($('preset').value) histBegin('Szablon stylu „' + $('preset').value.replace(/^u:/, '') + '” — zostawić?'); }, true);

/* ---------- panel visibility + fullscreen ---------- */
function togglePanel(force) {
  const app = document.querySelector('.app'), hide = force ?? !app.classList.contains('panel-hidden');
  app.classList.toggle('panel-hidden', hide); $('showPanel').hidden = !hide;
}
$('showPanel').onclick = () => togglePanel(false);
$('btnHidePanel').onclick = () => togglePanel(true);
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else (document.documentElement.requestFullscreen?.() || Promise.reject()).catch(() => toast('Pełny ekran niedostępny w tym widoku'));
}

/* ---------- keyboard shortcuts ---------- */
const KEYS = [
  ['Ctrl + Z', 'Cofnij'], ['Ctrl + Y  /  Ctrl + Shift + Z', 'Ponów'], ['Ctrl + S', 'Zapisz projekt'], ['Ctrl + O', 'Otwórz projekt'],
  ['Ctrl + Enter', 'Renderuj MP4'], ['Ctrl + Shift + S', 'Zrzut PNG'], ['P', 'Odtwórz / zatrzymaj sekwencję'], ['R', 'Nagrywaj na żywo / stop'],
  ['M', 'Poprzedni kształt'], ['1 – 6', 'Przejdź do kształtu'], ['Spacja', 'Rozsyp'], ['F', 'Pełny ekran'], ['H', 'Ukryj / pokaż panel'],
  ['Esc', 'Anuluj / zamknij / stop'], ['Enter', 'Gotowe (gdy widać pasek potwierdzenia)'], ['?', 'Ta lista skrótów']
];
$('keysList').innerHTML = KEYS.map(([k, v]) => `<dt>${k.split('  /  ').map(x => x.split(' + ').map(y => `<kbd>${y}</kbd>`).join(' + ')).join(' / ')}</dt><dd>${v}</dd>`).join('');
$('btnKeys').onclick = () => $('keysModal').hidden = false;
$('keysClose').onclick = () => $('keysModal').hidden = true;
addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  const typing = e.target.matches('input[type=text],input[type=number],input[type=password],textarea') || e.target.isContentEditable;
  if (e.key === 'Escape') {
    if (!$('keysModal').hidden) { $('keysModal').hidden = true; return; }
    if (!$('confirmBar').hidden) { confirmCancel(); return; }
    if (!$('maskModal').hidden) { $('maskModal').hidden = true; return; }
    if (!$('kiosk').hidden) { $('kioskExit').click(); return; }
    if (seq.playing) { stopSeq(); return; }
    return;
  }
  if (mod && k === 's' && !e.shiftKey) { e.preventDefault(); $('btnSaveProj').click(); return; }
  if (mod && k === 's' && e.shiftKey) { e.preventDefault(); $('btnPng').click(); return; }
  if (mod && k === 'o') { e.preventDefault(); $('projFile').click(); return; }
  if (mod && e.key === 'Enter') { e.preventDefault(); $('btnRender').click(); return; }
  if (typing) return;                                 // let text fields keep their own undo
  if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if (mod || e.altKey) return;
  if (e.target.matches('select')) return;
  if (e.key === 'Enter' && !$('confirmBar').hidden) { confirmKeep(); return; }
  if (k === 'p') { seq.playing ? stopSeq() : playSeq(); }
  else if (k === 'r') $('btnRec').click();
  else if (k === 'f') toggleFullscreen();
  else if (k === 'h') togglePanel();
  else if (e.key === '?') $('keysModal').hidden = false;
});
setTimeout(() => { hist.cur = histSnap(); histUI(); }, 1500);
