"""New motion physics in the particle shaders: vortex, implode, blow-away (sand), laser scan."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
f = ROOT / 'src/app.js'; s = f.read_text()
rep = [
 ("uniform float uTime,uDelta,uMorph,uSpring,uDamping,uNoise,uFlight,uScatter,uWave,uPointerRadius,uPointerStrength,uShock,uTrans,uWind,uGravity,uPour,uPourY,uPulse,uFlat;",
  "uniform float uTime,uDelta,uMorph,uSpring,uDamping,uNoise,uFlight,uScatter,uWave,uPointerRadius,uPointerStrength,uShock,uTrans,uWind,uGravity,uPour,uPourY,uPulse,uFlat,uVortex,uAttract,uBlow,uScan;\nuniform vec3 uBlowDir;"),
 ("  float hold=1.-uScatter;\n  vec3 acc=(target-p)*uSpring*12.*hold;",
  """  float hold=(1.-uScatter)*(1.-uVortex*.8)*(1.-uAttract);
  vec3 extra=vec3(0.);
  if(uBlow>0.){                                              // blown away like sand, one side first
    float k=clamp(dot(ta.xyz,uBlowDir)/3.6+.5,0.,1.); float rel=smoothstep(k*.8,k*.8+.2,uBlow);
    hold*=1.-rel; extra+=(uBlowDir*5.+vec3(0.,1.6,0.)+curl(p*.9+uTime*.4)*3.)*rel; }
  if(uScan>-8.) hold*=step(target.x,uScan);                  // laser scan: only what the line has passed is built
  extra+=(vec3(-p.z,0.,p.x)*4.+vec3(-p.x,0.,-p.z)*1.2+vec3(0.,1.4,0.))*uVortex;   // tornado
  extra+=(-p)*uAttract*22.;                                  // implode to the centre
  vec3 acc=(target-p)*uSpring*12.*hold+extra;"""),
 ("uPour: { value: 0 }, uPourY: { value: 2.2 }, uPulse: { value: 0 }, uFlat: { value: 0 },",
  "uPour: { value: 0 }, uPourY: { value: 2.2 }, uPulse: { value: 0 }, uFlat: { value: 0 }, uVortex: { value: 0 }, uAttract: { value: 0 }, uBlow: { value: 0 }, uScan: { value: -9 }, uBlowDir: { value: new THREE.Vector3(1, 0, 0) },"),
 ("uResinMix: { value: 0 }, uHide: { value: 0 }", "uResinMix: { value: 0 }, uHide: { value: 0 }, uScan: { value: -9 }"),
 ("      c=mix(c,rc,resin*uResinMix);", "      c=mix(c,rc,resin*uResinMix);\n      if(uScan>-8.) c+=vec3(.55,.95,1.)*exp(-pow((p.x-uScan)*7.,2.))*1.8;   // the laser line glows"),
]
for a, b in rep:
    assert a in s, a[:60]
    s = s.replace(a, b, 1)
# the render shader must declare uScan
a = "uniform float uMorph,uTrans,uSize,uViewH,uFovK,uTime,uColorMode,uDensFrom,uDensTo,uSizeBoost,uResinMix;"
assert a in s
s = s.replace(a, "uniform float uMorph,uTrans,uSize,uViewH,uFovK,uTime,uColorMode,uDensFrom,uDensTo,uSizeBoost,uResinMix,uScan;", 1)
f.write_text(s)
print('shader ok')
