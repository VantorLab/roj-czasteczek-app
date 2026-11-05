"""Example shapes, neon contour sampling, custom sprite style, hologram filter."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
f = ROOT / 'src/app.js'; s = f.read_text()
NEW_PROC = r'''    } else if (type === 'heart') {
      const t = Math.random() * Math.PI * 2, k = Math.sqrt(Math.random());
      const hx = 16 * Math.pow(Math.sin(t), 3), hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const rr = k * (0.92 + 0.08 * Math.random()), z = randn() * 0.28 * Math.sqrt(Math.max(0, 1 - k * k));
      put(n, hx * 0.1 * rr, hy * 0.1 * rr + 0.25, z, ...mix3([255, 60, 110], [255, 190, 210], k));
    } else if (type === 'saturn') {
      if (u < 0.58) { const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s2 = Math.sqrt(1 - z * z), r = 0.95; const band = 0.5 + 0.5 * Math.sin(z * 18);
        put(n, Math.cos(a) * s2 * r, z * r, Math.sin(a) * s2 * r, ...mix3([200, 120, 50], [255, 220, 150], band)); }
      else { const a = Math.random() * Math.PI * 2, r = 1.3 + Math.pow(Math.random(), 0.7) * 0.75, x = Math.cos(a) * r, z = Math.sin(a) * r, tl = 0.42;
        put(n, x, z * Math.sin(tl) + randn() * 0.01, z * Math.cos(tl), ...mix3([235, 215, 180], [150, 130, 110], (r - 1.3) / 0.75)); }
    } else if (type === 'dna') {
      const t = (Math.random() * 2 - 1) * 1.7, a = t * 3.2;
      if (u < 0.8) { const side = n % 2, aa = a + side * Math.PI, rr = 0.55 + randn() * 0.03;
        put(n, Math.cos(aa) * rr, t, Math.sin(aa) * rr, ...(side ? [90, 220, 255] : [255, 90, 200])); }
      else { const ts = Math.round(t * 5) / 5, aa = ts * 3.2, w = Math.random() * 2 - 1;
        put(n, Math.cos(aa) * 0.55 * w, ts + randn() * 0.01, Math.sin(aa) * 0.55 * w, 235, 245, 255); }
    } else if (type === 'knot') {
      const ph = Math.random() * Math.PI * 2, r0 = Math.cos(3 * ph) + 2, tube = 0.09;
      const c = new THREE.Color().setHSL(ph / (Math.PI * 2), 0.8, 0.6);
      put(n, r0 * Math.cos(2 * ph) * 0.55 + randn() * tube, r0 * Math.sin(2 * ph) * 0.55 + randn() * tube, -Math.sin(3 * ph) * 0.55 + randn() * tube, c.r * 255, c.g * 255, c.b * 255);
    } else if (type === 'butterfly') {
      const th = Math.random() * Math.PI * 12, r = Math.exp(Math.sin(th)) - 2 * Math.cos(4 * th) + Math.pow(Math.sin((2 * th - Math.PI) / 24), 5), k = Math.sqrt(Math.random());
      const x = Math.sin(th) * r * k * 0.42, y = Math.cos(th) * r * k * 0.42;
      put(n, x, y + 0.3, Math.abs(x) * 0.35 + randn() * 0.03, ...mix3([60, 120, 255], [255, 150, 60], k));
    } else if (type === 'vase') {
      const y = Math.random() * 3.2 - 1.6, a = Math.random() * Math.PI * 2, rad = 0.45 + 0.38 * Math.sin(y * 1.9 + 0.6) + 0.12 * (y < -1.4 ? 1 : 0);
      put(n, Math.cos(a) * rad, y, Math.sin(a) * rad, ...mix3([20, 110, 120], [170, 235, 225], (y + 1.6) / 3.2));
    } else if (type === 'wave') {
      const x = Math.random() * 3.6 - 1.8, z = Math.random() * 3.6 - 1.8, h = Math.sin(x * 2.2) * Math.cos(z * 1.8) * 0.32 + Math.sin(x * 5 + z * 3) * 0.06, tl = -0.95;
      put(n, x, h * Math.cos(tl) - z * Math.sin(tl), h * Math.sin(tl) + z * Math.cos(tl), ...mix3([30, 60, 200], [120, 255, 230], (h + 0.4) / 0.8));
    } else { /* jelly */'''
a = "    } else { /* jelly */"
assert a in s
s = s.replace(a, NEW_PROC, 1)
a = "const TYPES = { image: 'Zdjęcie / logo', text: 'Napis', model: 'Model 3D', jelly: 'Meduza', sphere: 'Kula', ring: 'Pierścień', galaxy: 'Galaktyka' };"
assert a in s
s = s.replace(a, "const TYPES = { image: 'Zdjęcie / logo', text: 'Napis', model: 'Model 3D', jelly: 'Meduza', heart: 'Serce', saturn: 'Saturn', dna: 'DNA', knot: 'Węzeł', butterfly: 'Motyl', vase: 'Wazon', wave: 'Fala', sphere: 'Kula', ring: 'Pierścień', galaxy: 'Galaktyka' };", 1)
a = """const shapes = [
  { type: 'image', img: flowerCanvas(), name: 'przykład', text: 'AI BIZNES' },
  { type: 'jelly', name: 'meduza', text: 'AI BIZNES' },
];"""
assert a in s
s = s.replace(a, """const shapes = [
  { type: 'image', img: flowerCanvas(), name: 'przykład', text: 'AI BIZNES' },
  { type: 'jelly', name: 'meduza', text: 'AI BIZNES' },
  { type: 'heart', name: 'serce', text: 'AI BIZNES' },
  { type: 'saturn', name: 'saturn', text: 'AI BIZNES' },
  { type: 'dna', name: 'dna', text: 'AI BIZNES' },
];""", 1)
# neon contour: only edge pixels become particles
a = "  let E = null;\n  if (opt.detail > 0) {"
assert a in s
s = s.replace(a, "  let E = null;\n  if (opt.detail > 0 || opt.contour) {", 1)
a = "    if (E) wgt *= 1 + opt.detail * 5 * E[i];"
assert a in s
s = s.replace(a, "    if (opt.contour && E) wgt = A[i] * smooth(0.12, 0.35, E[i]);\n    else if (E) wgt *= 1 + opt.detail * 5 * E[i];", 1)
a = "depthArr: depthArrFor(s, w, h), resin: resinClassifier() });"
assert a in s
s = s.replace(a, "depthArr: depthArrFor(s, w, h), resin: resinClassifier(), contour: $('contourOnly').checked });", 1)
a = "{ mode: 'dark', th: 0.08, depth: P.depth * 0.4, detail: 0, deglare: 0 });"
assert a in s
s = s.replace(a, "{ mode: 'dark', th: 0.08, depth: P.depth * 0.4, detail: 0, deglare: 0, contour: $('contourOnly').checked });", 1)
# custom sprite style 8
a = "uStyle: { value: 0 }, uStyleScale: { value: 1 }, tDigits: { value: null }"
assert a in s
s = s.replace(a, a + ", tSprite: { value: null }", 1)
a = "uniform float uOpacity,uInk,uHide,uStyle,uTime; uniform sampler2D tDigits;"
assert a in s
s = s.replace(a, "uniform float uOpacity,uInk,uHide,uStyle,uTime; uniform sampler2D tDigits,tSprite;", 1)
a = "      else if(uStyle<6.5) sh=step(max(abs(q.x),abs(q.y)),.4);                                                // pixel\n      else sh=smoothstep(.06,0.,abs(d-.34));"
assert a in s
s = s.replace(a, "      else if(uStyle<6.5) sh=step(max(abs(q.x),abs(q.y)),.4);                                                // pixel\n      else if(uStyle<7.5) sh=smoothstep(.06,0.,abs(d-.34));                                                  // ring\n      else { vec4 sp=texture2D(tSprite,vec2(q.x+.5,.5-q.y)); sh=sp.a*max(sp.r,max(sp.g,sp.b)); }           // your own sign / logo", 1)
f.write_text(s)

# hologram filter in the retro pass
f = ROOT / 'src/features5.js'; s = f.read_text()
a = "      } else { // melt / pixel-sort look: bright pixels smear downward"
assert a in s
s = s.replace(a, """      } else if(uMode>5.5){ // hologram: cyan projection, scanlines, flicker, sweeping light band, jitter
        float band=floor(vUv.y*90.); float jit=(h(vec2(floor(uTime*14.),band))-.5)*.01*step(.9,h(vec2(floor(uTime*4.),floor(band*.2))))*uAmt*2.;
        vec3 c=texture2D(tDiffuse,vUv+vec2(jit,0.)).rgb; float l=lum(c);
        vec3 holo=mix(vec3(.02,.25,.5),vec3(.6,1.,1.),smoothstep(0.,.8,l))*(.3+l*1.5);
        float scan=.72+.28*sin(px.y*1.7-uTime*24.); float flick=.9+.1*sin(uTime*47.)*sin(uTime*13.);
        float sweep=1.-smoothstep(0.,.02,abs(fract(vUv.y+uTime*.17)-.5));
        col=holo*scan*flick+vec3(.35,1.,1.)*sweep*.35*step(.03,l)+vec3(texture2D(tDiffuse,vUv+vec2(.005,0.)).r,0.,0.)*.12;
      } else { // melt / pixel-sort look: bright pixels smear downward""", 1)
f.write_text(s)

b = ROOT / 'src/body.html'; t = b.read_text()
a = '<option value="5">Topnienie (pixel-sort)</option></select></div>'
assert a in t
t = t.replace(a, '<option value="5">Topnienie (pixel-sort)</option><option value="6">Hologram</option></select></div>', 1)
a = '''        <div class="row"><label for="deglare">Gaś odblaski</label>'''
assert a in t
t = t.replace(a, '''        <label class="check"><input type="checkbox" id="contourOnly"> Tylko kontur (neon): cząsteczki tylko na krawędziach</label>
''' + a, 1)
a = '''        <div class="row"><label for="styleLen">Długość / skala</label>'''
assert a in t
t = t.replace(a, '''        <div class="row two"><label for="spriteChar">Własny znak</label><div class="pair"><input id="spriteChar" type="text" value="★" maxlength="3" aria-label="Znak cząsteczki"><span class="file-btn"><button type="button" tabindex="-1" style="width:100%">Wgraj logo</button><input id="spriteFile" type="file" accept="image/*" aria-label="Wgraj logo jako cząsteczkę"></span></div></div>
''' + a, 1)
b.write_text(t)
print('ok')
