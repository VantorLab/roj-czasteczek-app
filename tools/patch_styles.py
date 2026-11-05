"""Particle sprite styles (dots, dashes, streaks, matrix digits, stars, pixels, rings) + matrix rain physics."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
f = ROOT / 'src/app.js'; s = f.read_text()
rep = [
 # rain: each particle falls straight down its own column until it reaches its place
 ("uFlat,uVortex,uAttract,uBlow,uScan;\nuniform vec3 uBlowDir;", "uFlat,uVortex,uAttract,uBlow,uScan,uRain;\nuniform vec3 uBlowDir;"),
 ("  if(uPour>.5 && p.y>uPourY)", "  if(uRain>.5 && p.y>target.y+.03) acc=vec3(0.,-7.,0.);\n  if(uPour>.5 && p.y>uPourY)"),
 ("uBlow: { value: 0 }, uScan: { value: -9 }, uBlowDir:", "uBlow: { value: 0 }, uScan: { value: -9 }, uRain: { value: 0 }, uBlowDir:"),
 # render: style uniforms
 ("uResinMix: { value: 0 }, uHide: { value: 0 }, uScan: { value: -9 }", "uResinMix: { value: 0 }, uHide: { value: 0 }, uScan: { value: -9 }, uStyle: { value: 0 }, uStyleScale: { value: 1 }, tDigits: { value: null }"),
 ("uniform float uMorph,uTrans,uSize,uViewH,uFovK,uTime,uColorMode,uDensFrom,uDensTo,uSizeBoost,uResinMix,uScan;",
  "uniform float uMorph,uTrans,uSize,uViewH,uFovK,uTime,uColorMode,uDensFrom,uDensTo,uSizeBoost,uResinMix,uScan,uStyleScale;"),
 ("attribute vec2 ref; varying vec3 vColor; varying float vAlpha; varying float vDens;", "attribute vec2 ref; varying vec3 vColor; varying float vAlpha; varying float vDens; varying float vR; varying vec2 vDir;"),
 ("      float speed=length(texture2D(tVel,ref).xyz);", "      vec3 vel3=texture2D(tVel,ref).xyz; float speed=length(vel3); vR=r; vDir=vel3.xy;"),
 ("      gl_PointSize=uSize*uSizeBoost*(.55+r*.9)*uViewH/(uFovK*-mv.z);", "      gl_PointSize=uSize*uSizeBoost*uStyleScale*(.55+r*.9)*uViewH/(uFovK*-mv.z);"),
 ("varying vec3 vColor; varying float vAlpha; varying float vDens; uniform float uOpacity,uInk,uHide;\n    void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard;\n      float a=pow(1.-d*2.,1.6)*vAlpha*uOpacity*vDens; if(uInk>.5) a=smoothstep(.5,.35,d)*uOpacity;",
  """varying vec3 vColor; varying float vAlpha; varying float vDens; varying float vR; varying vec2 vDir; uniform float uOpacity,uInk,uHide,uStyle,uTime; uniform sampler2D tDigits;
    void main(){ vec2 q=gl_PointCoord-.5; float d=length(q); float sh;
      if(uStyle<.5){ if(d>.5) discard; sh=uInk>.5?smoothstep(.5,.35,d):pow(1.-d*2.,1.6); }
      else if(uStyle<1.5) sh=smoothstep(.5,.28,abs(q.x))*smoothstep(.07,.0,abs(q.y));                       // horizontal dash
      else if(uStyle<2.5) sh=smoothstep(.07,.0,abs(q.x))*smoothstep(.5,.28,abs(q.y));                       // vertical dash
      else if(uStyle<3.5){ vec2 u=length(vDir)>.02?normalize(vec2(vDir.x,-vDir.y)):vec2(1.,0.);               // streak along motion
        float sp=clamp(length(vDir)*.25,.15,1.); sh=smoothstep(.5*sp,.1*sp,abs(dot(q,u)))*smoothstep(.07,.0,abs(dot(q,vec2(-u.y,u.x)))); }
      else if(uStyle<4.5){ float idx=floor(fract(vR*7.31+floor(uTime*(1.5+vR*5.))*.137)*10.);                // matrix digits
        sh=texture2D(tDigits,vec2((idx+q.x+.5)/10.,.5-q.y)).r; }
      else if(uStyle<5.5) sh=min(1.,max(smoothstep(.05,0.,abs(q.x))*smoothstep(.5,0.,abs(q.y)),smoothstep(.05,0.,abs(q.y))*smoothstep(.5,0.,abs(q.x)))+smoothstep(.16,0.,d));   // star
      else if(uStyle<6.5) sh=step(max(abs(q.x),abs(q.y)),.4);                                                // pixel
      else sh=smoothstep(.06,0.,abs(d-.34));                                                                  // ring
      if(sh<.01) discard;
      float a=sh*vAlpha*uOpacity*vDens; if(uInk>.5) a=sh*uOpacity;"""),
]
for a, b in rep:
    assert a in s, a[:70]
    s = s.replace(a, b, 1)
f.write_text(s)
print('ok')
