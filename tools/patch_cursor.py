"""Cursor hover modes and click modes in the particle shaders."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
f = ROOT / 'src/app.js'; s = f.read_text()
a = """  vec3 d=p-uPointer; float dist=length(d);
  float f=1.-smoothstep(0.,uPointerRadius,dist); f*=f;
  acc+=d/(dist+1e-4)*f*uPointerStrength*28.+uPointerVel*f*35.;
  vec3 ds=p-uShockOrigin; float sd=length(ds);
  acc+=ds/(sd+1e-4)*uShock*exp(-sd*1.4)*55.;"""
assert a in s
s = s.replace(a, """  vec3 d=p-uPointer; float dist=length(d); vec3 dn=d/(dist+1e-4);
  float f=1.-smoothstep(0.,uPointerRadius,dist); f*=f;
  if(uHoverMode<.5) acc+=dn*f*uPointerStrength*28.+uPointerVel*f*35.;                       // push away
  else if(uHoverMode<1.5) acc+=-dn*f*uPointerStrength*24.+uPointerVel*f*20.;                // magnet
  else if(uHoverMode<2.5) acc+=vec3(-dn.y,dn.x,0.)*f*uPointerStrength*34.;                   // whirl
  else if(uHoverMode<3.5) acc+=vec3(dn.xy*.35,1.)*f*uPointerStrength*26.;                    // magnifier: bulge to camera
  else if(uHoverMode<4.5) acc+=dn*sin(dist*20.-uTime*12.)*f*uPointerStrength*26.;           // ripple rings
  vec3 ds=p-uShockOrigin; float sd=length(ds); vec3 sn=ds/(sd+1e-4);
  if(uShockMode<.5) acc+=sn*uShock*exp(-sd*1.4)*55.;                                        // shockwave
  else if(uShockMode<1.5) acc+=(sn+vec3(0.,.4,.6))*uShock*exp(-sd*.7)*95.;                   // explosion
  else if(uShockMode<2.5) acc+=(uShock>0.?-sn*exp(-sd*.5)*36.:sn*exp(-sd*.9)*-70.)*uShock;   // black hole, then spit out
  else if(uShockMode<3.5){ float R=(1.-uShock)*3.2; acc+=sn*exp(-pow((sd-R)*5.,2.))*uShock*60.; }  // expanding ring
  else acc+=(sn*.7+vec3(0.,1.,0.))*uShock*exp(-sd*.9)*70.;                                   // firework burst""", 1)
a = "uFlat,uVortex,uAttract,uBlow,uScan,uRain;"
assert a in s
s = s.replace(a, "uFlat,uVortex,uAttract,uBlow,uScan,uRain,uHoverMode,uShockMode;", 1)
a = "uRain: { value: 0 }, uBlowDir:"
assert a in s
s = s.replace(a, "uRain: { value: 0 }, uHoverMode: { value: 0 }, uShockMode: { value: 0 }, uBlowDir:", 1)
# hover glow in the render shader
a = "uStyle: { value: 0 }, uStyleScale: { value: 1 }, tDigits: { value: null }, tSprite: { value: null }"
assert a in s
s = s.replace(a, a + ", uPointerR: { value: new THREE.Vector3(99, 99, 99) }, uHoverGlow: { value: 0 }, uHoverR: { value: .5 }", 1)
a = "uniform float uMorph,uTrans,uSize,uViewH,uFovK,uTime,uColorMode,uDensFrom,uDensTo,uSizeBoost,uResinMix,uScan,uStyleScale;"
assert a in s
s = s.replace(a, a + " uniform vec3 uPointerR; uniform float uHoverGlow,uHoverR;", 1)
a = "      if(uScan>-8.) c+=vec3(.55,.95,1.)*exp(-pow((p.x-uScan)*7.,2.))*1.8;   // the laser line glows"
assert a in s
s = s.replace(a, a + "\n      c+=uHoverGlow*vec3(.7,.95,1.)*exp(-pow(length(p.xy-uPointerR.xy)/uHoverR*1.6,2.))*1.4;   // light under the cursor", 1)
f.write_text(s)

b = ROOT / 'src/body.html'; t = b.read_text()
a = '''        <div class="row"><label for="pStrength">Siła kursora</label>'''
assert a in t
t = t.replace(a, '''        <div class="row two"><label for="hoverMode">Najechanie</label><select id="hoverMode"><option value="0">Odpychanie</option><option value="1">Magnes (przyciąga)</option><option value="2">Wir</option><option value="3">Lupa (wypukłość)</option><option value="4">Fale</option><option value="5">Tylko podświetlenie</option><option value="6">Nic</option></select></div>
        <div class="row two"><label for="clickMode">Kliknięcie</label><select id="clickMode"><option value="0">Fala uderzeniowa</option><option value="1">Eksplozja</option><option value="2">Czarna dziura</option><option value="3">Pierścień</option><option value="4">Fajerwerk</option><option value="5">Następny kształt</option><option value="6">Zmień kolory</option><option value="7">Nic</option></select></div>
        <label class="check"><input type="checkbox" id="hoverGlow" checked> Podświetlenie pod kursorem</label>
''' + a, 1)
b.write_text(t)
print('ok')
