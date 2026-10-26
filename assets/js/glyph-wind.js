/*
 * Glyph wind — adapted from Henry Fan's MIT-licensed Background Lab.
 * https://github.com/Henry-fan88/claude-code-background
 * License: ../licenses/glyph-wind-MIT.txt. Original noise and atlas shaders;
 * site-specific lifecycle, palette, readability, and interaction integration.
 */
(() => {
  "use strict";
  const vertex = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 viewport, cellSize, gridOrigin, pane;
uniform int columns, sequence[64], sequenceLength;
uniform float seed, clockTime, wallTime, reveal, fillRate, changeRate;
uniform vec4 flow, bending, textureShape, activity;
uniform vec4 quiet;
uniform int zoneCount;
uniform vec4 zones[64];
uniform float tail, sweep, evolve;
uniform int tapCount, wakeCount;
uniform vec4 taps[6], wakes[48];
out vec2 atlasUV;
out float luminance, blue;
const vec2 corners[6]=vec2[6](vec2(0,0),vec2(1,0),vec2(1,1),vec2(0,0),vec2(1,1),vec2(0,1));
float hash(vec2 p){return fract(sin(dot(p,vec2(127.13,311.77))+seed*.017)*43758.31);}
float noise(vec2 p){
  vec2 base=floor(p), q=fract(p);q=q*q*(3.-2.*q);
  return mix(mix(hash(base),hash(base+vec2(1,0)),q.x),mix(hash(base+vec2(0,1)),hash(base+vec2(1)),q.x),q.y);
}
float cloud(vec2 p,float age){
  float sum=0., weight=.5, total=0.;
  for(int k=0;k<4;k++){
    vec2 drift=age*vec2(.019+float(k)*.007,-.013-float(k)*.004);
    sum+=weight*noise(p+drift+float(k)*13.37);total+=weight;
    p=mat2(1.74,-.58,.58,1.74)*p+vec2(7.9,21.2);weight*=mix(.35,.65,textureShape.x);
  }
  return sum/total;
}
void main(){
  int row=gl_InstanceID/columns, col=gl_InstanceID-row*columns;
  vec2 cell=vec2(col,row);
  vec2 pixel=gridOrigin+(cell+.5)*cellSize;
  vec2 p=pixel*pane/viewport;
  if(hash(cell+19.)>fillRate){gl_Position=vec4(2,2,0,1);atlasUV=vec2(0);luminance=0.;blue=0.;return;}
  float age=clockTime*evolve;
  vec2 dir=vec2(cos(flow.x),sin(flow.x));
  vec2 across=vec2(-dir.y,dir.x);
  vec2 bend=vec2(noise(p/bending.y+age*.012),noise(p/bending.y+vec2(21.3,-age*.009)))-.5;
  vec2 shifted=p+bend*bending.x*2.;
  vec2 q=vec2(dot(shifted,dir)-clockTime*flow.y,dot(shifted,across));
  vec2 eddy=vec2(noise(q/(flow.w*1.2)+age*.014),noise(q/(flow.w*.8)+vec2(7.2,-age*.01)))-.5;
  q+=eddy*flow.w*textureShape.z*1.2;
  float field=cloud(q/flow.zw,age);
  float threads=1.-smoothstep(0.,.28,abs(noise(q/vec2(140.,30.)+age*.008)-.5));
  field+=textureShape.w*.1*(threads-.5)+sweep*.08*cos(q.x/max(pane.x*.17,120.));
  float threshold=.28+bending.z*.4-tail*.035;
  float band=mix(.19,.045,textureShape.y);
  float lit=pow(smoothstep(threshold-band,threshold+band,field),2.);
  lit*=mix(1.,.32+.68*threads,bending.w);
  float warmth=0.;
  for(int j=0;j<48;j++){
    if(j>=wakeCount)break;
    float t=max(0.,wallTime-wakes[j].z),radius=50.+40.*t;
    float heat=(1.-exp(-t/.05))*exp(-t/.65);
    warmth+=wakes[j].w*heat*exp(-dot(p-wakes[j].xy,p-wakes[j].xy)/(radius*radius));
  }
  warmth=1.-exp(-1.5*warmth);
  lit=mix(lit,max(lit,.7*cloud(q/vec2(35.,22.),age)),warmth);
  float glow=0.,push=0.;
  for(int j=0;j<6;j++){
    if(j>=tapCount)break;
    float t=max(0.,wallTime-taps[j].z),radius=620.*(1.-exp(-t/1.3)),width=85.+60.*t;
    vec2 offset=p-taps[j].xy;
    float distance=abs(length(offset)-radius);
    float ring=exp(-4.*distance*distance/(width*width));
    float envelope=(1.-exp(-t/.05))*exp(-t/1.0)*abs(taps[j].w);
    glow+=ring*envelope;push+=ring*envelope*.75;
  }
  vec2 center=(p-vec2(pane.x*.5,pane.y*quiet.w))/quiet.xy;
  float calm=1.-(1.-quiet.z)*exp(-.9*dot(center,center));
  for(int z=0;z<64;z++){
    if(z>=zoneCount)break;
    vec2 c=(zones[z].xy+zones[z].zw)*.5;
    vec2 halfSize=(zones[z].zw-zones[z].xy)*.5;
    float qx=max(0.,abs(p.x-c.x)-max(0.,halfSize.x-12.))/45.;
    float qy=(p.y-c.y)/(halfSize.y+22.);
    calm=min(calm,1.-.7*exp(-qx*qx-qy*qy));
  }
  float shown=max(reveal,clamp(warmth+push,0.,1.));
  luminance=(min(1.,lit+push)+activity.x)*calm*shown;
  blue=glow*activity.y*calm;
  int stepIndex=int(floor(clockTime*changeRate*(.6+.8*hash(cell+9.))+hash(cell)*50.+push*5.));
  int glyph=sequence[(int(hash(cell+77.)*997.)+stepIndex)%sequenceLength];
  vec2 corner=corners[gl_VertexID];
  atlasUV=(vec2(glyph%16,glyph/16)+corner)/vec2(16.,6.);
  vec2 location=gridOrigin+(cell+corner)*cellSize;
  location+=vec2(sin(age*.3+p.y*.018),cos(age*.2+p.x*.013))*warmth*2.5*viewport/pane;
  gl_Position=vec4(location/viewport*vec2(2.,-2.)+vec2(-1.,1.),0,1);
}`;
  const fragment = `#version 300 es
precision highp float;
uniform sampler2D atlas;
uniform vec3 inkColor,glowColor;
uniform float inkOpacity,friction;
in vec2 atlasUV;
in float luminance,blue;
out vec4 color;
void main(){
  float coverage=texture(atlas,atlasUV).a;
  if(coverage<.001)discard;
  float shading=mix(1.,.7+.3*coverage,friction);
  float alpha=coverage*clamp(luminance*inkOpacity*shading/3.+blue*.85,0.,1.);
  vec3 rgb=mix(inkColor,glowColor,smoothstep(.04,.3,blue));
  color=vec4(rgb*alpha,alpha);
}`;
  const original = document.querySelector('[data-field-canvas]');
  if (!original) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'field-canvas glyph-wind';
  canvas.setAttribute('aria-hidden', 'true');
  original.after(canvas);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let gl, program, texture, frame = 0, width = 0, height = 0, scale = 1;
  let time = 22, last = 0, painted = 0, taps = [], wakes = [], pointer = null;
  let layoutDirty = true, zones = [], lost = false;
  const uniforms = new Map();
  const now = () => performance.now() / 1000;
  const active = () => document.documentElement.dataset.field === 'wind';
  const loc = name => {
    if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name));
    return uniforms.get(name);
  };
  const one = (n, v) => gl.uniform1f(loc(n), v);
  const integer = (n, v) => gl.uniform1i(loc(n), v);
  const two = (n, x, y) => gl.uniform2f(loc(n), x, y);
  const four = (n, ...v) => gl.uniform4f(loc(n), ...v);
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message);
    }
    return shader;
  }
  function setup() {
    uniforms.clear();
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs);
    gl.linkProgram(program); gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    integer('atlas', 0);
    const chars = '.:;+-=*/<>[]{}()01abcdefxyz';
    const sequence = new Int32Array(64);
    [...chars].forEach((c, i) => sequence[i] = c.charCodeAt(0) - 32);
    gl.uniform1iv(loc('sequence'), sequence); integer('sequenceLength', chars.length);
    resize();
  }
  function resize() {
    if (lost) return;
    width = innerWidth; height = innerHeight;
    scale = Math.min(devicePixelRatio || 1, 2, Math.sqrt(8000000 / (width * height)));
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    // Oversampled atlas keeps nine-pixel glyphs crisp at fractional display scales.
    const atlas = document.createElement('canvas'); atlas.width = 16 * 26; atlas.height = 6 * 52;
    const ctx = atlas.getContext('2d');
    ctx.font = '400 36px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    for (let i = 0; i < 96; i++) ctx.fillText(String.fromCharCode(32 + i), (i % 16 + .5) * 26, (Math.floor(i / 16) + .5) * 52);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    layoutDirty = true; refresh();
  }
  function readLayout() {
    zones = [...document.querySelectorAll('.site-header, .site-footer, .hero-copy, .page-intro, .hero-tab-panel-head, .hero-tab-more, .content-card')]
      .flatMap(el => {
        const rects = [];
        if (el.matches('.hero-copy, .page-intro')) {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            if (!walker.currentNode.textContent.trim()) continue;
            const range = document.createRange(); range.selectNodeContents(walker.currentNode);
            rects.push(...range.getClientRects());
          }
          el.querySelectorAll('svg, img').forEach(icon => rects.push(icon.getBoundingClientRect()));
        } else rects.push(el.getBoundingClientRect());
        const clip = el.closest('.hero-tab-list, .content-list-region, .mobile-tab-section-list')?.getBoundingClientRect();
        return rects.map(r => [r.left, Math.max(r.top, clip?.top ?? r.top), r.right, Math.min(r.bottom, clip?.bottom ?? r.bottom)]);
      }).filter(r => r[2] > r[0] && r[3] > r[1] && r[3] > 0 && r[1] < height).slice(0, 64);
    layoutDirty = false;
  }
  function draw() {
    if (lost || !active()) return;
    if (layoutDirty) readLayout();
    const wall = now(), dark = document.documentElement.dataset.theme === 'midnight-navy';
    taps = taps.filter(t => wall - t[2] < 4);
    wakes = wakes.filter(w => wall - w[2] < 2.4);
    gl.useProgram(program); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    two('viewport', canvas.width, canvas.height); two('pane', width, height);
    two('cellSize', 6.5 * scale, 13 * scale); two('gridOrigin', 0, 0);
    integer('columns', Math.ceil(width / 6.5));
    one('seed', 3197); one('clockTime', time); one('wallTime', wall);
    one('reveal', 1); one('fillRate', .96); one('changeRate', .32);
    four('flow', .48, 27, 470, 150); four('bending', 105, 360, .49, .4);
    four('textureShape', .62, .72, .8, .65); four('quiet', 250, 150, 1, .45);
    four('activity', .025, dark ? .23 : .13, 0, 0);
    one('tail', .4); one('sweep', .3); one('evolve', 1.5); one('friction', .6);
    integer('zoneCount', zones.length);
    if (zones.length) gl.uniform4fv(loc('zones'), new Float32Array(zones.flat()));
    integer('tapCount', taps.length);
    integer('wakeCount', wakes.length);
    if (wakes.length) gl.uniform4fv(loc('wakes'), new Float32Array(wakes.flat()));
    if (taps.length) gl.uniform4fv(loc('taps'), new Float32Array(taps.flat()));
    gl.uniform3fv(loc('inkColor'), dark ? [.25, .57, .69] : [.29, .41, .49]);
    gl.uniform3fv(loc('glowColor'), dark ? [.28, .77, .94] : [.20, .43, .57]);
    one('inkOpacity', dark ? .72 : .47);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.ceil(width / 6.5) * Math.ceil(height / 13));
  }
  function tick(ms) {
    frame = 0;
    if (document.hidden || !active() || lost || motion.matches) return;
    const dt = Math.min((ms - last) / 1000, .06); last = ms; time += dt;
    if (ms - painted >= (taps.length || wakes.length ? 1000 / 60 : 1000 / 30)) {
      if (Math.abs(Math.min(devicePixelRatio || 1, 2, Math.sqrt(8000000 / (innerWidth * innerHeight))) - scale) > .01) { resize(); return; }
      draw(); painted = ms;
    }
    frame = requestAnimationFrame(tick);
  }
  function refresh() {
    cancelAnimationFrame(frame); frame = 0;
    if (lost || document.hidden || !active()) return;
    if (motion.matches) { taps = []; wakes = []; pointer = null; }
    draw(); last = performance.now();
    if (!motion.matches) frame = requestAnimationFrame(tick);
  }
  function fallback() {
    canvas.hidden = true;
    window.glyphWindFallback = true;
    original.style.visibility = 'visible';
    window.dispatchEvent(new Event('site-field-change'));
  }
  try {
    gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
    if (!gl) throw new Error('WebGL2 unavailable');
    setup();
  } catch (error) { console.warn('Glyph wind renderer unavailable:', error); fallback(); return; }
  window.addEventListener('pointermove', event => {
    if (motion.matches || !active() || event.pointerType !== 'mouse') return;
    const t = now(), x = event.clientX, y = event.clientY;
    if (pointer && t - pointer.t < .2) {
      const distance = Math.hypot(x - pointer.x, y - pointer.y);
      if (distance < 12 || t - pointer.t < .025) return;
      wakes.push([x, y, t, Math.min(.8, distance / 90)]); wakes = wakes.slice(-32);
    }
    pointer = { x, y, t };
  }, { passive: true });
  window.addEventListener('pointerdown', event => {
    if (motion.matches || !active() || event.button !== 0 || event.target.closest('.content-card, a, button, input, select, textarea')) return;
    taps.push([event.clientX, event.clientY, now(), .85]); taps = taps.slice(-6);
  }, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('site-theme-change', refresh);
  window.addEventListener('site-field-change', refresh);
  document.addEventListener('visibilitychange', refresh);
  motion.addEventListener('change', refresh);
  const invalidate = () => { layoutDirty = true; if (motion.matches) refresh(); };
  document.addEventListener('scroll', invalidate, { passive: true, capture: true });
  window.addEventListener('site-layout-change', invalidate);
  document.addEventListener('transitionend', invalidate);
  document.fonts.ready.then(invalidate);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    try { setup(); } catch { fallback(); }
  });
})();
