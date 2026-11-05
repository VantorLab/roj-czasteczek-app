"""One-off: parallax controls in the Ruch tab + register features8.js in the build."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
b = (ROOT / 'src/body.html').read_text()
anchor = '''        <label class="check"><input type="checkbox" id="autoRot"> Powolny obrót kamery</label>
      </section>'''
assert anchor in b
b = b.replace(anchor, anchor + '''
      <section>
        <h2>Paralaksa <small>żyroskop / kursor</small></h2>
        <label class="check"><input type="checkbox" id="parallaxOn"> Przechyl telefon, a scena 3D obróci się z nim (na komputerze: ruch kursora)</label>
        <div class="row"><label for="parallaxAmt">Siła</label><input id="parallaxAmt" type="range" min="0.2" max="2" step="0.01" value="1"><output for="parallaxAmt"></output></div>
        <div class="btns"><button type="button" id="parallaxReset">Wyzeruj pozycję telefonu</button></div>
        <p class="note">Na iPhonie przy pierwszym włączeniu zgódź się na dostęp do „Ruchu i orientacji”. Najlepiej wygląda z reliefem 3D i głębią AI. Działa w aplikacji na telefon; podgląd w Claude nie ma dostępu do czujników.</p>
      </section>''', 1)
(ROOT / 'src/body.html').write_text(b)
bp = (ROOT / 'tools/build.py').read_text()
bp = bp.replace("'features7.js', 'boot.js'", "'features7.js', 'features8.js', 'boot.js'")
(ROOT / 'tools/build.py').write_text(bp)
print('ok', 'features8.js' in bp)
