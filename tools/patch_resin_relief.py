"""Resin recolouring for the relief and glass effects (same rule as the particle shader)."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
GLSL = r'''uniform vec3 uResinColor,uWoodHSV; uniform float uResinMix,uEdge;
vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1e-10; return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x); }
vec3 resinize(vec3 lin){ if(uResinMix<.001) return lin;
  vec3 h=rgb2hsv(pow(max(lin,0.),vec3(1./2.2))); float dh=abs(h.x-uWoodHSV.x); dh=min(dh,1.-dh)*2.;
  float dd=sqrt(dh*dh*1.4+(h.y-uWoodHSV.y)*(h.y-uWoodHSV.y)*.35+(h.z-uWoodHSV.z)*(h.z-uWoodHSV.z)*1.1);
  float glare=(h.y<.12&&h.z>.85)?1.:0.; float rw=(1.-glare)*smoothstep(uEdge,uEdge+.12,dd);
  float l=dot(lin,vec3(.2126,.7152,.0722)); vec3 rc=mix(uResinColor*.3,uResinColor*1.35,smoothstep(0.,.45,l))+vec3(max(0.,l-.72)*1.6);
  return mix(lin,rc,rw*uResinMix); }
'''
f = ROOT / 'src/features4.js'; s = f.read_text()
a = "  fragmentShader: `uniform sampler2D map; uniform vec3 uLightDir; uniform float uOpacity,uShade; varying vec2 vUv; varying vec3 vPos;\n    void main(){ vec4 c=texture2D(map,vUv); if(c.a<.4) discard;"
assert a in s
s = s.replace(a, "  fragmentShader: `uniform sampler2D map; uniform vec3 uLightDir; uniform float uOpacity,uShade; varying vec2 vUv; varying vec3 vPos;\n" + GLSL + "    void main(){ vec4 c=texture2D(map,vUv); if(c.a<.4) discard; c.rgb=resinize(c.rgb);")
a2 = "uShade: { value: .6 }, uLightDir: { value: new THREE.Vector3(.5, .7, .9) } },"
assert a2 in s
s = s.replace(a2, "uShade: { value: .6 }, uLightDir: { value: new THREE.Vector3(.5, .7, .9) }, ...resinUniforms() },")
a3 = "      u.uLightDir.value.set(Math.sin(T * .25) * .6 + .3, .7, .9);"
assert a3 in s
s = s.replace(a3, a3 + "\n      syncResin(u);")
# shared helpers, defined before first use (function declarations are hoisted)
s = s.replace("/* the current shape as a picture (+ depth) for picture-based effects */", '''function resinUniforms() { return { uResinColor: { value: new THREE.Color() }, uWoodHSV: { value: new THREE.Vector3() }, uResinMix: { value: 0 }, uEdge: { value: .26 } }; }
function syncResin(u) {   // copy the live resin state (colour fades, mix, wood colour, edge) into a material
  u.uResinColor.value.copy(renderUniforms.uResinColor.value); u.uResinMix.value = renderUniforms.uResinMix.value; u.uEdge.value = P.resinEdge;
  const w = new THREE.Color($('woodColor').value).convertLinearToSRGB(), hsv = rgb2hsv(w.r, w.g, w.b); u.uWoodHSV.value.set(hsv[0], hsv[1], hsv[2]);
}
/* the current shape as a picture (+ depth) for picture-based effects */''', 1)
f.write_text(s)

f = ROOT / 'src/features5.js'; s = f.read_text()
b1 = "    fragmentShader: `uniform sampler2D map; uniform float uCrack; varying vec2 vUv; varying vec3 vBary,vN; varying float vT;\n      void main(){ vec4 c=texture2D(map,vUv); if(c.a<.3) discard;"
assert b1 in s
s = s.replace(b1, "    fragmentShader: `uniform sampler2D map; uniform float uCrack; varying vec2 vUv; varying vec3 vBary,vN; varying float vT;\n" + GLSL + "      void main(){ vec4 c=texture2D(map,vUv); if(c.a<.3) discard; c.rgb=resinize(c.rgb);")
b2 = "uImpact: { value: new THREE.Vector3(0, 0, 0) }, uSpread: { value: Math.max(sx, sy) } },"
assert b2 in s
s = s.replace(b2, "uImpact: { value: new THREE.Vector3(0, 0, 0) }, uSpread: { value: Math.max(sx, sy) }, ...resinUniforms() },")
b3 = "    const u = glass.mesh.material.uniforms; u.uT.value = glass.t;"
assert b3 in s
s = s.replace(b3, "    const u = glass.mesh.material.uniforms; syncResin(u); u.uT.value = glass.t;")
f.write_text(s)

f = ROOT / 'tools/make_tutorial.js'; s = f.read_text()
s = s.replace("  await p.selectOption('#fxMode', 'particles'); await wait(3500);\n", "")
s = s.replace("  await click('#tabs button[data-tab=look]'); await p.uncheck('#additive');", "  await click('#tabs button[data-tab=look]'); await p.uncheck('#additive'); await p.uncheck('#autoPerf');")
f.write_text(s)
print('ok')
