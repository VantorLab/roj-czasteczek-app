"""Particle-look controls in the Effects tab + build order."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
b = (ROOT / 'src/body.html').read_text()
a = '''    <div class="pane" data-pane="fx" hidden>
      <section>'''
assert a in b
b = b.replace(a, '''    <div class="pane" data-pane="fx" hidden>
      <section>
        <h2>Wygląd cząsteczek</h2>
        <div class="row two"><label for="pStyle">Kształt</label><select id="pStyle"></select></div>
        <div class="row"><label for="styleLen">Długość / skala</label><input id="styleLen" type="range" min="0.4" max="2.5" step="0.01" value="1"><output for="styleLen"></output></div>
        <p class="note">Kreski, smugi, cyfry Matrix, gwiazdki, piksele albo pierścienie zamiast kropek. Gotowe połączenia znajdziesz w Sekwencja → Co ma się dziać?</p>
      </section>
      <section>''', 1)
(ROOT / 'src/body.html').write_text(b)
bp = (ROOT / 'tools/build.py').read_text()
bp = bp.replace("'features9.js', 'boot.js'", "'features9.js', 'features10.js', 'boot.js'")
(ROOT / 'tools/build.py').write_text(bp)
print('ok', 'features10.js' in bp)
