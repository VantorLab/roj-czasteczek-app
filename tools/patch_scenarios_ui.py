"""Scenario gallery at the top of the Sequence tab + build order."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
b = (ROOT / 'src/body.html').read_text()
a = '''    <div class="pane" data-pane="seq" hidden>
      <section>'''
assert a in b
b = b.replace(a, '''    <div class="pane" data-pane="seq" hidden>
      <section>
        <h2>Co ma się dziać? <small>kliknij, by ustawić i odtworzyć</small></h2>
        <div class="scenarios" id="scenarios"></div>
      </section>
      <section>''', 1)
(ROOT / 'src/body.html').write_text(b)
c = (ROOT / 'src/style.css').read_text()
c = c.replace('\n@media (max-width:760px){', '''
.scenarios{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.scenario{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;border-radius:8px;padding:8px 10px;background:var(--raise);min-width:0}
.scenario b{font-weight:700;color:var(--foam);font-size:12px}
.scenario span{font-weight:400;color:var(--mist);font-size:11px;line-height:1.35}
.scenario.on{border-color:var(--glow);box-shadow:0 0 0 1px var(--glow)}
@media (max-width:760px){''', 1)
(ROOT / 'src/style.css').write_text(c)
bp = (ROOT / 'tools/build.py').read_text()
bp = bp.replace("'features8.js', 'boot.js'", "'features8.js', 'features9.js', 'boot.js'")
(ROOT / 'tools/build.py').write_text(bp)
# the Sequence tab is easier to find if the hint mentions it
print('ok', 'features9.js' in bp)
