"""One-off: add the undo toolbar, confirm bar, shortcuts dialog and panel toggle to the markup + styles."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
b = (ROOT / 'src/body.html').read_text()
b = b.replace('''    <nav class="tabs" role="tablist" id="tabs">''', '''    <div class="toolbar">
      <button type="button" id="histUndo" title="Cofnij (Ctrl+Z)" disabled>↶ Cofnij</button>
      <button type="button" id="histRedo" title="Ponów (Ctrl+Y)" disabled>↷ Ponów</button>
      <span class="grow"></span>
      <button type="button" id="btnKeys" title="Skróty klawiszowe (?)">Skróty</button>
      <button type="button" id="btnHidePanel" title="Ukryj panel (H)">Ukryj panel</button>
    </div>
    <nav class="tabs" role="tablist" id="tabs">''', 1)
b = b.replace('''    <div class="busy" id="busy" hidden>''', '''    <div class="confirm-bar" id="confirmBar" hidden role="status"><span id="confirmText">Zostawić zmianę?</span><button type="button" class="primary" id="confirmKeep">Gotowe</button><button type="button" id="confirmCancel">Anuluj</button></div>
    <button type="button" class="show-panel" id="showPanel" hidden>Pokaż panel (H)</button>
    <div class="busy" id="busy" hidden>''', 1)
b = b.replace('''<div class="toast" id="toast" hidden></div>''', '''<div class="modal keys" id="keysModal" hidden role="dialog" aria-modal="true" aria-labelledby="keysTitle">
  <div class="keys-card">
    <header><h3 id="keysTitle">Skróty klawiszowe</h3><button type="button" id="keysClose">Zamknij (Esc)</button></header>
    <dl id="keysList"></dl>
    <p class="note">Na Macu zamiast Ctrl użyj Cmd. W polach tekstowych Ctrl+Z cofa tylko pisanie.</p>
  </div>
</div>
<div class="toast" id="toast" hidden></div>''', 1)
(ROOT / 'src/body.html').write_text(b)

c = (ROOT / 'src/style.css').read_text()
c = c.replace('\n@media (max-width:760px){', '''
.toolbar{display:flex;align-items:center;gap:6px;padding:10px 12px 0;padding-right:max(12px,env(safe-area-inset-right,0px));flex:none}
.toolbar button{padding:5px 10px;font-size:11.5px}
.toolbar .grow{flex:1}
.confirm-bar{position:absolute;left:50%;bottom:58px;transform:translateX(-50%);z-index:8;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;max-width:calc(100% - 32px);background:var(--deep);border:1px solid var(--glow);border-radius:999px;padding:6px 6px 6px 16px;font-size:12.5px;box-shadow:0 8px 30px rgba(0,0,0,.45)}
.show-panel{position:absolute;top:max(16px,env(safe-area-inset-top,0px));right:max(16px,env(safe-area-inset-right,0px));z-index:4;background:color-mix(in srgb,var(--abyss) 70%,transparent)}
.app.panel-hidden{grid-template-columns:minmax(0,1fr)}
.app.panel-hidden .panel{display:none}
.modal.keys{align-items:center;justify-content:center}
.keys-card{background:var(--deep);border:1px solid var(--line);border-radius:12px;padding:18px 20px;max-width:560px;width:100%;max-height:100%;overflow:auto;display:flex;flex-direction:column;gap:12px}
.keys-card header{display:flex;justify-content:space-between;align-items:center;gap:10px}
.keys-card dl{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin:0;align-items:center}
.keys-card dt{white-space:nowrap;font-size:12px;color:var(--mist)}
.keys-card dd{margin:0;font-size:13px}
kbd{font-family:var(--font-mono);font-size:11px;border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;padding:1px 6px;color:var(--foam);background:var(--abyss)}
@media (max-width:760px){
  .app.panel-hidden{grid-template-rows:100% 0}''', 1)
(ROOT / 'src/style.css').write_text(c)

bp = (ROOT / 'tools/build.py').read_text()
bp = bp.replace("'features6.js', 'boot.js'", "'features6.js', 'features7.js', 'boot.js'")
(ROOT / 'tools/build.py').write_text(bp)
print('ok', 'features7.js' in bp, b.count('confirmBar'))
